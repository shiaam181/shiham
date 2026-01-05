import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, CheckCircle2, XCircle, Clock, Calendar, Trash2, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  addNotificationDismissed,
  addNotificationRead,
  getNotificationPrefs,
  markAllNotificationsRead,
} from '@/lib/notificationPrefs';

interface Notification {
  id: string;
  type: 'leave_approved' | 'leave_rejected' | 'leave_pending';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: {
    leaveId?: string;
    leaveType?: string;
    startDate?: string;
    endDate?: string;
  };
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  admin_notes: string | null;
  updated_at: string;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchRecentLeaves = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['approved', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const prefs = getNotificationPrefs(user.id);

      const notifs: Notification[] = (data || [])
        .map((leave: LeaveRequest) => ({
          id: leave.id,
          type: (leave.status === 'approved' ? 'leave_approved' : 'leave_rejected') as Notification['type'],
          title: leave.status === 'approved' ? 'Leave Approved' : 'Leave Rejected',
          message: `Your ${leave.leave_type} leave (${format(new Date(leave.start_date), 'MMM d')} - ${format(new Date(leave.end_date), 'MMM d')}) has been ${leave.status}${leave.admin_notes ? `. Note: ${leave.admin_notes}` : ''}`,
          timestamp: new Date(leave.updated_at),
          read: prefs.readIds.has(leave.id),
          data: {
            leaveId: leave.id,
            leaveType: leave.leave_type,
            startDate: leave.start_date,
            endDate: leave.end_date,
          },
        }))
        .filter((n) => !prefs.dismissedIds.has(n.id));

      setNotifications(notifs);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchRecentLeaves();
  }, [fetchRecentLeaves]);

  // Subscribe to realtime leave updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notification-leave-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leave_requests',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const leave = payload.new as LeaveRequest;
          if (leave.status === 'approved' || leave.status === 'rejected') {
            const prefs = getNotificationPrefs(user.id);

            // If user dismissed it before, don't re-add it.
            if (prefs.dismissedIds.has(leave.id)) return;

            const newNotif: Notification = {
              id: leave.id,
              type: (leave.status === 'approved' ? 'leave_approved' : 'leave_rejected') as Notification['type'],
              title: leave.status === 'approved' ? 'Leave Approved' : 'Leave Rejected',
              message: `Your ${leave.leave_type} leave has been ${leave.status}`,
              timestamp: new Date(),
              read: prefs.readIds.has(leave.id),
              data: {
                leaveId: leave.id,
                leaveType: leave.leave_type,
                startDate: leave.start_date,
                endDate: leave.end_date,
              },
            };
            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== leave.id)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (user) addNotificationRead(user.id, id);
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user) markAllNotificationsRead(user.id, notifications.map((n) => n.id));
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (user) addNotificationDismissed(user.id, id);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'leave_approved':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'leave_rejected':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'leave_pending':
        return <Clock className="w-4 h-4 text-warning" />;
      default:
        return <Calendar className="w-4 h-4 text-info" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-popover border border-border shadow-lg">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="font-display font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
               onClick={() => {
                 markAllAsRead();
               }}
              className="h-auto py-1 px-2 text-xs"
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${
                  !notification.read ? 'bg-accent/50' : ''
                }`}
                onClick={() => {
                  markAsRead(notification.id);
                  setIsOpen(false);
                  navigate(`/notifications?id=${notification.id}`);
                }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{notification.title}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearNotification(notification.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground/70">
                      {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                    </p>
                    <ExternalLink className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
