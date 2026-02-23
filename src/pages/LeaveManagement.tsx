import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
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
import AppLayout from '@/components/AppLayout';

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
  const { user } = useAuth();
  const { logLeaveApproval } = useAuditLog();
  
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
    if (!selectedRequest || !user) return;

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: action,
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Log the action for audit trail
      await logLeaveApproval(
        selectedRequest.id,
        action,
        selectedRequest.status,
        adminNotes || undefined
      );

      // Send email notification if EmailJS is configured
      const profile = profiles[selectedRequest.user_id];
      if (profile && isEmailJSConfigured()) {
        // Fetch user's email from profiles
        const { data: userData } = await supabase
          .from('profiles')
          .select('email')
          .eq('user_id', selectedRequest.user_id)
          .maybeSingle();

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
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(fromDeveloper ? '/developer' : '/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm sm:text-lg truncate">Leave Management</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Review and manage leave requests</p>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-warning-soft flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-display font-bold">
                  {leaveRequests.filter(r => r.status === 'pending').length}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-success-soft flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-display font-bold">
                  {leaveRequests.filter(r => r.status === 'approved').length}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-destructive-soft flex items-center justify-center shrink-0">
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-display font-bold">
                  {leaveRequests.filter(r => r.status === 'rejected').length}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-display font-bold">{leaveRequests.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Leave Requests Table */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Leave Requests</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Review and manage employee leave requests</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 w-full grid grid-cols-4 h-auto p-1">
                <TabsTrigger value="pending" className="text-[10px] sm:text-sm py-2 px-1">
                  Pending ({leaveRequests.filter(r => r.status === 'pending').length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="text-[10px] sm:text-sm py-2 px-1">Approved</TabsTrigger>
                <TabsTrigger value="rejected" className="text-[10px] sm:text-sm py-2 px-1">Rejected</TabsTrigger>
                <TabsTrigger value="all" className="text-[10px] sm:text-sm py-2 px-1">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Leave Type</TableHead>
                      <TableHead className="text-xs sm:text-sm">Duration</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">Days</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Reason</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
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
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{profile?.full_name || 'Unknown'}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[80px] sm:max-w-none hidden sm:block">{profile?.department || '-'}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{getLeaveTypeBadge(request.leave_type)}</TableCell>
                            <TableCell>
                              <div className="text-[10px] sm:text-sm">
                                <p>{format(new Date(request.start_date), 'MMM d')}</p>
                                <p className="text-muted-foreground">to {format(new Date(request.end_date), 'MMM d')}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs sm:text-sm">{days}d</TableCell>
                            <TableCell className="hidden lg:table-cell max-w-[150px] truncate text-xs sm:text-sm">{request.reason || '-'}</TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                            <TableCell className="text-right">
                              {request.status === 'pending' ? (
                                <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => openReviewDialog(request)}>
                                  Review
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => openReviewDialog(request)}>
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
                </div>
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
    </AppLayout>
  );
}
