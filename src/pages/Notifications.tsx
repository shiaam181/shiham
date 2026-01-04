import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar,
  User,
  FileText,
  Bell
} from 'lucide-react';
import { format } from 'date-fns';

interface LeaveRequestDetail {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

interface ReviewerProfile {
  full_name: string;
}

export default function Notifications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [leaveRequest, setLeaveRequest] = useState<LeaveRequestDetail | null>(null);
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [allNotifications, setAllNotifications] = useState<LeaveRequestDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const leaveId = searchParams.get('id');

  const fetchLeaveRequest = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setLeaveRequest(data);

      // Fetch reviewer name if available
      if (data?.reviewed_by) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', data.reviewed_by)
          .single();
        
        if (profileData) {
          setReviewerName(profileData.full_name);
        }
      }
    } catch (error) {
      console.error('Error fetching leave request:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchAllNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['approved', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAllNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (leaveId) {
      fetchLeaveRequest(leaveId);
    } else {
      fetchAllNotifications();
    }
  }, [leaveId, fetchLeaveRequest, fetchAllNotifications]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-6 h-6 text-destructive" />;
      case 'pending':
        return <Clock className="w-6 h-6 text-yellow-500" />;
      default:
        return <Calendar className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatLeaveType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show detailed view for a specific notification
  if (leaveId && leaveRequest) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto py-6 px-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Card className="border-border">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-4">
                {getStatusIcon(leaveRequest.status)}
                <div className="flex-1">
                  <CardTitle className="text-xl">
                    Leave Request {leaveRequest.status === 'approved' ? 'Approved' : 'Rejected'}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Updated {format(new Date(leaveRequest.updated_at), 'PPpp')}
                  </p>
                </div>
                {getStatusBadge(leaveRequest.status)}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Leave Type */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Calendar className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Leave Type</p>
                  <p className="text-lg font-semibold">{formatLeaveType(leaveRequest.leave_type)}</p>
                </div>
              </div>

              {/* Date Range */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Duration</p>
                  <p className="text-lg font-semibold">
                    {format(new Date(leaveRequest.start_date), 'MMMM d, yyyy')} 
                    {leaveRequest.start_date !== leaveRequest.end_date && (
                      <> — {format(new Date(leaveRequest.end_date), 'MMMM d, yyyy')}</>
                    )}
                  </p>
                </div>
              </div>

              {/* Reason */}
              {leaveRequest.reason && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <FileText className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Your Reason</p>
                    <p className="mt-1">{leaveRequest.reason}</p>
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              {leaveRequest.admin_notes && (
                <div className={`flex items-start gap-3 p-4 rounded-lg ${
                  leaveRequest.status === 'approved' 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : 'bg-destructive/10 border border-destructive/20'
                }`}>
                  <FileText className={`w-5 h-5 mt-0.5 ${
                    leaveRequest.status === 'approved' ? 'text-green-500' : 'text-destructive'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Admin Notes</p>
                    <p className="mt-1">{leaveRequest.admin_notes}</p>
                  </div>
                </div>
              )}

              {/* Reviewed By */}
              {reviewerName && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <User className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reviewed By</p>
                    <p className="text-lg font-semibold">{reviewerName}</p>
                    {leaveRequest.reviewed_at && (
                      <p className="text-sm text-muted-foreground">
                        on {format(new Date(leaveRequest.reviewed_at), 'PPpp')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Request Info */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Request submitted on {format(new Date(leaveRequest.created_at), 'PPpp')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show all notifications list
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-6 px-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>

        {allNotifications.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {allNotifications.map((notification) => (
              <Card 
                key={notification.id}
                className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/notifications?id=${notification.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {getStatusIcon(notification.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">
                          {formatLeaveType(notification.leave_type)} Leave {notification.status === 'approved' ? 'Approved' : 'Rejected'}
                        </p>
                        {getStatusBadge(notification.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(notification.start_date), 'MMM d')} - {format(new Date(notification.end_date), 'MMM d, yyyy')}
                      </p>
                      {notification.admin_notes && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          Note: {notification.admin_notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {format(new Date(notification.updated_at), 'PPp')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}