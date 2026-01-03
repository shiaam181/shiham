import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendLeaveStatusEmail, isEmailJSConfigured } from '@/lib/emailjs';
import { format, differenceInDays } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Calendar, 
  Check, 
  X,
  Clock,
  User
} from 'lucide-react';
import RoleBasedHeader from '@/components/RoleBasedHeader';

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profile?: {
    full_name: string;
    department: string | null;
  };
}

export default function LeaveManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const fromDeveloper = location.state?.from === 'developer';
  
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; department: string | null }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const fetchLeaveRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaveRequests(data || []);

      // Fetch profiles for all users
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, department')
          .in('user_id', userIds);

        if (profilesData) {
          const profileMap: Record<string, { full_name: string; department: string | null }> = {};
          profilesData.forEach(p => {
            profileMap[p.user_id] = { full_name: p.full_name, department: p.department };
          });
          setProfiles(profileMap);
        }
      }
    } catch (error: any) {
      console.error('Error fetching leave requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leave requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const handleReview = async (action: 'approved' | 'rejected') => {
    if (!selectedRequest) return;

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: action,
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Send email notification if EmailJS is configured
      const profile = profiles[selectedRequest.user_id];
      if (profile && isEmailJSConfigured()) {
        // Fetch user's email from profiles
        const { data: userData } = await supabase
          .from('profiles')
          .select('email')
          .eq('user_id', selectedRequest.user_id)
          .single();

        if (userData?.email) {
          await sendLeaveStatusEmail({
            to_name: profile.full_name,
            to_email: userData.email,
            leave_type: selectedRequest.leave_type,
            start_date: format(new Date(selectedRequest.start_date), 'MMM d, yyyy'),
            end_date: format(new Date(selectedRequest.end_date), 'MMM d, yyyy'),
            status: action,
            admin_notes: adminNotes || undefined,
          });
        }
      }

      toast({
        title: 'Success',
        description: `Leave request ${action}`,
      });

      setShowReviewDialog(false);
      setSelectedRequest(null);
      setAdminNotes('');
      fetchLeaveRequests();
    } catch (error: any) {
      console.error('Error updating leave request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update leave request',
        variant: 'destructive',
      });
    }
  };

  const openReviewDialog = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || '');
    setShowReviewDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="present">Approved</Badge>;
      case 'rejected':
        return <Badge variant="absent">Rejected</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    switch (type) {
      case 'sick':
        return <Badge variant="destructive">Sick Leave</Badge>;
      case 'casual':
        return <Badge variant="secondary">Casual Leave</Badge>;
      case 'earned':
        return <Badge variant="default">Earned Leave</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const filteredRequests = leaveRequests.filter(r => {
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'approved') return r.status === 'approved';
    if (activeTab === 'rejected') return r.status === 'rejected';
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <RoleBasedHeader currentView={fromDeveloper ? 'developer' : 'admin'} />

      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(fromDeveloper ? '/developer' : '/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display font-bold text-lg">Leave Management</h1>
            <p className="text-xs text-muted-foreground">Review and manage leave requests</p>
          </div>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning-soft flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {leaveRequests.filter(r => r.status === 'pending').length}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success-soft flex items-center justify-center">
                <Check className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {leaveRequests.filter(r => r.status === 'approved').length}
                </p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive-soft flex items-center justify-center">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {leaveRequests.filter(r => r.status === 'rejected').length}
                </p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Calendar className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{leaveRequests.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Leave Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
            <CardDescription>Review and manage employee leave requests</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="pending">
                  Pending ({leaveRequests.filter(r => r.status === 'pending').length})
                </TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No leave requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map((request) => {
                        const profile = profiles[request.user_id];
                        const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
                        
                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">{profile?.department || '-'}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{getLeaveTypeBadge(request.leave_type)}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{format(new Date(request.start_date), 'MMM d, yyyy')}</p>
                                <p className="text-muted-foreground">to {format(new Date(request.end_date), 'MMM d, yyyy')}</p>
                              </div>
                            </TableCell>
                            <TableCell>{days} day{days > 1 ? 's' : ''}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{request.reason || '-'}</TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                            <TableCell className="text-right">
                              {request.status === 'pending' ? (
                                <Button variant="outline" size="sm" onClick={() => openReviewDialog(request)}>
                                  Review
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={() => openReviewDialog(request)}>
                                  View
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest?.status === 'pending' ? 'Review Leave Request' : 'Leave Request Details'}
            </DialogTitle>
            <DialogDescription>
              {profiles[selectedRequest?.user_id || '']?.full_name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Leave Type</p>
                  <p className="font-medium capitalize">{selectedRequest.leave_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {differenceInDays(new Date(selectedRequest.end_date), new Date(selectedRequest.start_date)) + 1} days
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">From</p>
                  <p className="font-medium">{format(new Date(selectedRequest.start_date), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">To</p>
                  <p className="font-medium">{format(new Date(selectedRequest.end_date), 'MMM d, yyyy')}</p>
                </div>
              </div>

              {selectedRequest.reason && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reason</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedRequest.reason}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-1">Admin Notes</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes (optional)"
                  rows={3}
                  disabled={selectedRequest.status !== 'pending'}
                />
              </div>

              {selectedRequest.status === 'pending' ? (
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={() => handleReview('rejected')}>
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button onClick={() => handleReview('approved')}>
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </DialogFooter>
              ) : (
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
