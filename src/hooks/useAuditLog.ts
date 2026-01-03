import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export type AuditAction = 
  | 'leave_approved'
  | 'leave_rejected'
  | 'attendance_updated'
  | 'attendance_deleted'
  | 'role_changed'
  | 'employee_deactivated'
  | 'employee_activated'
  | 'settings_updated'
  | 'shift_created'
  | 'shift_updated'
  | 'shift_deleted'
  | 'holiday_created'
  | 'holiday_updated'
  | 'holiday_deleted';

interface AuditLogEntry {
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_value?: Json;
  new_value?: Json;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = async (entry: AuditLogEntry): Promise<boolean> => {
    if (!user) {
      console.error('Cannot log action: No authenticated user');
      return false;
    }

    try {
      const { error } = await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action: entry.action,
        table_name: entry.table_name,
        record_id: entry.record_id,
        old_value: entry.old_value ?? null,
        new_value: entry.new_value ?? null,
      }]);

      if (error) {
        console.error('Failed to create audit log:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error creating audit log:', error);
      return false;
    }
  };

  const logLeaveApproval = async (
    requestId: string,
    action: 'approved' | 'rejected',
    oldStatus: string,
    adminNotes?: string
  ) => {
    return logAction({
      action: action === 'approved' ? 'leave_approved' : 'leave_rejected',
      table_name: 'leave_requests',
      record_id: requestId,
      old_value: { status: oldStatus } as Json,
      new_value: { status: action, admin_notes: adminNotes } as Json,
    });
  };

  const logAttendanceUpdate = async (
    attendanceId: string,
    oldData: Json,
    newData: Json
  ) => {
    return logAction({
      action: 'attendance_updated',
      table_name: 'attendance',
      record_id: attendanceId,
      old_value: oldData,
      new_value: newData,
    });
  };

  const logRoleChange = async (
    userId: string,
    oldRole: string,
    newRole: string
  ) => {
    return logAction({
      action: 'role_changed',
      table_name: 'user_roles',
      record_id: userId,
      old_value: { role: oldRole } as Json,
      new_value: { role: newRole } as Json,
    });
  };

  const logEmployeeStatusChange = async (
    profileId: string,
    isActive: boolean
  ) => {
    return logAction({
      action: isActive ? 'employee_activated' : 'employee_deactivated',
      table_name: 'profiles',
      record_id: profileId,
      new_value: { is_active: isActive } as Json,
    });
  };

  return {
    logAction,
    logLeaveApproval,
    logAttendanceUpdate,
    logRoleChange,
    logEmployeeStatusChange,
  };
}
