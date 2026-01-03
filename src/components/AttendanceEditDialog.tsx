import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Save, AlertCircle } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  notes: string | null;
  admin_notes: string | null;
  overtime_minutes: number | null;
}

interface AttendanceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendance: AttendanceRecord | null;
  employeeName: string;
  onUpdate: () => void;
}

export default function AttendanceEditDialog({
  open,
  onOpenChange,
  attendance,
  employeeName,
  onUpdate,
}: AttendanceEditDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { logAttendanceUpdate } = useAuditLog();
  const [isLoading, setIsLoading] = useState(false);
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [status, setStatus] = useState('present');
  const [adminNotes, setAdminNotes] = useState('');

  // Initialize form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && attendance) {
      setCheckInTime(attendance.check_in_time ? format(new Date(attendance.check_in_time), 'HH:mm') : '');
      setCheckOutTime(attendance.check_out_time ? format(new Date(attendance.check_out_time), 'HH:mm') : '');
      setStatus(attendance.status);
      setAdminNotes(attendance.admin_notes || '');
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!attendance || !user) return;

    setIsLoading(true);
    try {
      // Capture old values for audit log
      const oldData = {
        status: attendance.status,
        check_in_time: attendance.check_in_time,
        check_out_time: attendance.check_out_time,
        admin_notes: attendance.admin_notes,
      };

      const updateData: Record<string, any> = {
        status,
        admin_notes: adminNotes || null,
        updated_at: new Date().toISOString(),
        modified_by: user.id,
      };

      // Convert time inputs to full timestamps
      if (checkInTime) {
        const checkInDate = new Date(attendance.date);
        const [hours, minutes] = checkInTime.split(':').map(Number);
        checkInDate.setHours(hours, minutes, 0, 0);
        updateData.check_in_time = checkInDate.toISOString();
      } else {
        updateData.check_in_time = null;
      }

      if (checkOutTime) {
        const checkOutDate = new Date(attendance.date);
        const [hours, minutes] = checkOutTime.split(':').map(Number);
        checkOutDate.setHours(hours, minutes, 0, 0);
        updateData.check_out_time = checkOutDate.toISOString();
      } else {
        updateData.check_out_time = null;
      }

      const { error } = await supabase
        .from('attendance')
        .update(updateData)
        .eq('id', attendance.id);

      if (error) throw error;

      // Log the audit trail
      await logAttendanceUpdate(
        attendance.id,
        oldData as Json,
        {
          status,
          check_in_time: updateData.check_in_time,
          check_out_time: updateData.check_out_time,
          admin_notes: adminNotes || null,
          modified_by: user.id,
        } as Json
      );

      toast({
        title: 'Success',
        description: 'Attendance record updated successfully',
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating attendance:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update attendance',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!attendance) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Edit Attendance
          </DialogTitle>
          <DialogDescription>
            {employeeName} - {format(new Date(attendance.date), 'MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-warning-soft rounded-lg border border-warning/20">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
            <p className="text-sm text-warning">
              Changes will be logged and can be audited. Please provide admin notes explaining the modification.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkInTime">Check-in Time</Label>
              <Input
                id="checkInTime"
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOutTime">Check-out Time</Label>
              <Input
                id="checkOutTime"
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="leave">On Leave</SelectItem>
                <SelectItem value="half-day">Half Day</SelectItem>
                <SelectItem value="late">Late</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminNotes">Admin Notes (Required)</Label>
            <Textarea
              id="adminNotes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Explain why this modification was made..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !adminNotes.trim()}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
