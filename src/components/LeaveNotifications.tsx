import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Check, X } from 'lucide-react';

interface LeaveNotificationsProps {
  onLeaveUpdate?: () => void;
}

export default function LeaveNotifications({ onLeaveUpdate }: LeaveNotificationsProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleLeaveUpdate = useCallback((payload: any) => {
    const { new: newRecord, old: oldRecord, eventType } = payload;
    
    // Only notify if this is an update to the current user's leave request
    if (newRecord?.user_id !== user?.id) return;
    
    // Only notify on status changes
    if (eventType === 'UPDATE' && oldRecord?.status !== newRecord?.status) {
      const isApproved = newRecord.status === 'approved';
      const isRejected = newRecord.status === 'rejected';
      
      if (isApproved) {
        toast({
          title: '🎉 Leave Approved!',
          description: `Your leave request has been approved.`,
          duration: 5000,
        });
      } else if (isRejected) {
        toast({
          title: 'Leave Request Rejected',
          description: newRecord.admin_notes 
            ? `Reason: ${newRecord.admin_notes}`
            : 'Your leave request has been rejected.',
          variant: 'destructive',
          duration: 5000,
        });
      }
      
      // Trigger refresh callback
      onLeaveUpdate?.();
    }
  }, [user?.id, toast, onLeaveUpdate]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('leave-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leave_requests',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => handleLeaveUpdate({ ...payload, eventType: 'UPDATE' })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, handleLeaveUpdate]);

  // This component doesn't render anything visible
  return null;
}
