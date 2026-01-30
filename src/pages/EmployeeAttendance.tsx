import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  User,
  Save,
  Calendar,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  getDay,
  isToday,
  isFuture,
} from 'date-fns';
import RoleBasedHeader from '@/components/RoleBasedHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import type { Json } from '@/integrations/supabase/types';

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  company_id: string | null;
}

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

const statusColors: Record<string, string> = {
  present: 'bg-success text-success-foreground hover:bg-success/80',
  absent: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
  leave: 'bg-info text-info-foreground hover:bg-info/80',
  week_off: 'bg-muted text-muted-foreground hover:bg-muted/80',
  holiday: 'bg-warning text-warning-foreground hover:bg-warning/80',
  half_day: 'bg-info/70 text-info-foreground hover:bg-info/60',
  late: 'bg-warning/70 text-warning-foreground hover:bg-warning/60',
  punch_missing: 'bg-destructive/70 text-destructive-foreground hover:bg-destructive/60',
};

const statusLabels: Record<string, string> = {
  present: 'P',
  absent: 'A',
  leave: 'L',
  week_off: 'W',
  holiday: 'H',
  half_day: 'HD',
  late: 'LT',
  punch_missing: 'PM',
};

export default function EmployeeAttendance() {
  const { id: employeeUserId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, role, isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { logAttendanceUpdate } = useAuditLog();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const [weekOffs, setWeekOffs] = useState<Set<number>>(new Set([0, 6]));
  const [isLoading, setIsLoading] = useState(true);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState('present');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch employee info
  useEffect(() => {
    const fetchEmployee = async () => {
      if (!employeeUserId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', employeeUserId)
        .single();

      if (error) {
        console.error('Error fetching employee:', error);
        toast({
          title: 'Error',
          description: 'Employee not found',
          variant: 'destructive',
        });
        navigate('/admin');
        return;
      }

      // Check if owner has access to this employee
      if (role === 'owner' && profile?.company_id && data.company_id !== profile.company_id) {
        toast({
          title: 'Access Denied',
          description: 'You can only view your company employees',
          variant: 'destructive',
        });
        navigate('/admin');
        return;
      }

      setEmployee(data);
    };

    if (!authLoading) {
      fetchEmployee();
    }
  }, [employeeUserId, authLoading, role, profile?.company_id, navigate, toast]);

  // Fetch monthly attendance data
  const fetchMonthlyData = useCallback(async () => {
    if (!employeeUserId) return;

    setIsLoading(true);
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    try {
      // Fetch attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', employeeUserId)
        .gte('date', start)
        .lte('date', end);

      if (attendanceError) throw attendanceError;

      const attendanceMap = new Map<string, AttendanceRecord>();
      attendanceData?.forEach(record => {
        attendanceMap.set(record.date, record);
      });
      setAttendance(attendanceMap);

      // Fetch holidays
      const { data: holidayData, error: holidayError } = await supabase
        .from('holidays')
        .select('date, name')
        .gte('date', start)
        .lte('date', end);

      if (holidayError) throw holidayError;
      const holidayMap = new Map<string, string>();
      holidayData?.forEach(h => holidayMap.set(h.date, h.name));
      setHolidays(holidayMap);

      // Fetch global week offs
      const { data: weekOffData } = await supabase
        .from('week_offs')
        .select('day_of_week')
        .eq('is_global', true);

      if (weekOffData && weekOffData.length > 0) {
        setWeekOffs(new Set(weekOffData.map(w => w.day_of_week)));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load attendance data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [employeeUserId, currentMonth, toast]);

  useEffect(() => {
    if (employee) {
      fetchMonthlyData();
    }
  }, [employee, fetchMonthlyData]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const startDayOfWeek = getDay(startOfMonth(currentMonth));
  const emptyDays = Array(startDayOfWeek).fill(null);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDayStatus = (date: Date): { status: string; record: AttendanceRecord | null; isHoliday: boolean; holidayName?: string } => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date);

    if (holidays.has(dateStr)) {
      return { status: 'holiday', record: null, isHoliday: true, holidayName: holidays.get(dateStr) };
    }

    const record = attendance.get(dateStr);
    if (record) {
      return { status: record.status, record, isHoliday: false };
    }

    if (weekOffs.has(dayOfWeek)) {
      return { status: 'week_off', record: null, isHoliday: false };
    }

    if (!isFuture(date) && !isToday(date)) {
      return { status: 'absent', record: null, isHoliday: false };
    }

    return { status: '', record: null, isHoliday: false };
  };

  const handleDayClick = (date: Date) => {
    if (isFuture(date)) {
      toast({
        title: 'Cannot Edit',
        description: 'Cannot modify future dates',
      });
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const { status, record, isHoliday, holidayName } = getDayStatus(date);

    if (isHoliday) {
      toast({
        title: 'Holiday',
        description: `${format(date, 'MMMM d, yyyy')} - ${holidayName}`,
      });
      return;
    }

    setEditingDate(date);
    setEditingRecord(record);
    setEditStatus(record?.status || status || 'present');
    setEditCheckIn(record?.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : '');
    setEditCheckOut(record?.check_out_time ? format(new Date(record.check_out_time), 'HH:mm') : '');
    setEditAdminNotes(record?.admin_notes || '');
    setShowEditDialog(true);
  };

  const handleSaveAttendance = async () => {
    if (!editingDate || !employee || !user) return;

    setIsSaving(true);
    const dateStr = format(editingDate, 'yyyy-MM-dd');

    try {
      if (editingRecord) {
        // Update existing record
        const oldData = {
          status: editingRecord.status,
          check_in_time: editingRecord.check_in_time,
          check_out_time: editingRecord.check_out_time,
          admin_notes: editingRecord.admin_notes,
        };

        const updateData: Record<string, any> = {
          status: editStatus,
          admin_notes: editAdminNotes || null,
          updated_at: new Date().toISOString(),
          modified_by: user.id,
        };

        if (editCheckIn) {
          const checkInDate = new Date(dateStr);
          const [hours, minutes] = editCheckIn.split(':').map(Number);
          checkInDate.setHours(hours, minutes, 0, 0);
          updateData.check_in_time = checkInDate.toISOString();
        } else {
          updateData.check_in_time = null;
        }

        if (editCheckOut) {
          const checkOutDate = new Date(dateStr);
          const [hours, minutes] = editCheckOut.split(':').map(Number);
          checkOutDate.setHours(hours, minutes, 0, 0);
          updateData.check_out_time = checkOutDate.toISOString();
        } else {
          updateData.check_out_time = null;
        }

        const { error } = await supabase
          .from('attendance')
          .update(updateData)
          .eq('id', editingRecord.id);

        if (error) throw error;

        await logAttendanceUpdate(
          editingRecord.id,
          oldData as Json,
          { ...updateData, modified_by: user.id } as Json
        );
      } else {
        // Create new record
        const insertData = {
          user_id: employee.user_id,
          date: dateStr,
          status: editStatus,
          admin_notes: editAdminNotes || null,
          check_in_time: null as string | null,
          check_out_time: null as string | null,
        };

        if (editCheckIn) {
          const checkInDate = new Date(dateStr);
          const [hours, minutes] = editCheckIn.split(':').map(Number);
          checkInDate.setHours(hours, minutes, 0, 0);
          insertData.check_in_time = checkInDate.toISOString();
        }

        if (editCheckOut) {
          const checkOutDate = new Date(dateStr);
          const [hours, minutes] = editCheckOut.split(':').map(Number);
          checkOutDate.setHours(hours, minutes, 0, 0);
          insertData.check_out_time = checkOutDate.toISOString();
        }

        const { error } = await supabase
          .from('attendance')
          .insert(insertData);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Attendance updated successfully',
      });

      setShowEditDialog(false);
      fetchMonthlyData();
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save attendance',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <RoleBasedHeader currentView="admin" />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 pb-20 sm:pb-6">
        {/* Back Button & Employee Info */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">{employee.full_name}</h1>
              <p className="text-sm text-muted-foreground">
                {employee.department || 'No department'} • {employee.position || 'No position'}
              </p>
            </div>
          </div>
        </div>

        {/* Attendance Calendar */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Attendance
              </CardTitle>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h3 className="font-display font-semibold text-lg">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                disabled={isFuture(addMonths(startOfMonth(currentMonth), 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs mt-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-success" />
                <span>Present</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-destructive" />
                <span>Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-info" />
                <span>Leave</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-warning" />
                <span>Holiday</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-muted" />
                <span>Week Off</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-destructive/70" />
                <span>Punch Missing</span>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Week day headers */}
                {weekDays.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}

                {/* Empty cells */}
                {emptyDays.map((_, index) => (
                  <div key={`empty-${index}`} className="aspect-square" />
                ))}

                {/* Days */}
                {days.map(day => {
                  const { status, record, isHoliday } = getDayStatus(day);
                  const isFutureDay = isFuture(day);
                  const canEdit = !isFutureDay && !isHoliday;

                  return (
                    <div
                      key={day.toString()}
                      onClick={() => canEdit && handleDayClick(day)}
                      className={`
                        aspect-square flex flex-col items-center justify-center rounded-lg text-sm
                        transition-all duration-200
                        ${canEdit ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-default'}
                        ${isToday(day) ? 'ring-2 ring-primary ring-offset-2' : ''}
                        ${status ? statusColors[status] || 'bg-muted/30' : 'bg-muted/20'}
                        ${isFutureDay ? 'opacity-50' : ''}
                      `}
                    >
                      <span className="font-medium">{format(day, 'd')}</span>
                      {status && (
                        <span className="text-[10px] font-bold opacity-80">
                          {statusLabels[status] || '-'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="text-2xl font-bold text-success">
              {Array.from(attendance.values()).filter(a => a.status === 'present').length}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Absent</p>
            <p className="text-2xl font-bold text-destructive">
              {Array.from(attendance.values()).filter(a => a.status === 'absent').length}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Leave</p>
            <p className="text-2xl font-bold text-info">
              {Array.from(attendance.values()).filter(a => a.status === 'leave').length}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Late</p>
            <p className="text-2xl font-bold text-warning">
              {Array.from(attendance.values()).filter(a => a.status === 'late').length}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Punch Missing</p>
            <p className="text-2xl font-bold text-destructive/70">
              {Array.from(attendance.values()).filter(a => a.status === 'punch_missing').length}
            </p>
          </Card>
        </div>
      </main>

      <MobileBottomNav />

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Edit Attendance
            </DialogTitle>
            <DialogDescription>
              {employee.full_name} - {editingDate && format(editingDate, 'MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-warning-soft rounded-lg border border-warning/20">
              <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
              <p className="text-sm text-warning">
                Changes will be logged. Please add notes to explain the modification.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="leave">On Leave</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="week_off">Week Off</SelectItem>
                  <SelectItem value="punch_missing">Punch Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check-in Time</Label>
                <Input
                  type="time"
                  value={editCheckIn}
                  onChange={(e) => setEditCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Check-out Time</Label>
                <Input
                  type="time"
                  value={editCheckOut}
                  onChange={(e) => setEditCheckOut(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <Textarea
                value={editAdminNotes}
                onChange={(e) => setEditAdminNotes(e.target.value)}
                placeholder="Reason for modification..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAttendance} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
