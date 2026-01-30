import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Search,
  Calendar,
  User,
  Users,
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
import AttendanceEditDialog from './AttendanceEditDialog';

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
  present: 'bg-success text-success-foreground',
  absent: 'bg-destructive text-destructive-foreground',
  leave: 'bg-info text-info-foreground',
  week_off: 'bg-muted text-muted-foreground',
  holiday: 'bg-warning text-warning-foreground',
  half_day: 'bg-info/50 text-info-foreground',
  late: 'bg-warning/70 text-warning-foreground',
};

const statusLabels: Record<string, string> = {
  present: 'P',
  absent: 'A',
  leave: 'L',
  week_off: 'W',
  holiday: 'H',
  half_day: 'HD',
  late: 'LT',
};

export default function MonthlyAttendanceManager() {
  const { profile, role, isAdmin, isDeveloper } = useAuth();
  const { toast } = useToast();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [weekOffs, setWeekOffs] = useState<Set<number>>(new Set([0, 6]));
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editingEmployeeName, setEditingEmployeeName] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, user_id, full_name, email, department, position, company_id')
        .eq('is_active', true);

      // If owner (not admin/developer), filter to their company only
      if (role === 'owner' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, [role, profile?.company_id]);

  const fetchMonthlyData = useCallback(async () => {
    setIsLoading(true);
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    try {
      // Build attendance query
      let attendanceQuery = supabase
        .from('attendance')
        .select('*')
        .gte('date', start)
        .lte('date', end);

      // Filter by selected employee if not 'all'
      if (selectedEmployee !== 'all') {
        attendanceQuery = attendanceQuery.eq('user_id', selectedEmployee);
      }

      const { data: attendanceData, error: attendanceError } = await attendanceQuery;
      if (attendanceError) throw attendanceError;

      // Filter by company for owners
      const employeeUserIds = new Set(employees.map(e => e.user_id));
      const filteredAttendance = (attendanceData || []).filter(record =>
        role === 'owner' ? employeeUserIds.has(record.user_id) : true
      );

      // Create a map with composite key: date-userId
      const attendanceMap = new Map<string, AttendanceRecord>();
      filteredAttendance.forEach(record => {
        const key = `${record.date}-${record.user_id}`;
        attendanceMap.set(key, record);
      });
      setAttendance(attendanceMap);

      // Fetch holidays
      const { data: holidayData, error: holidayError } = await supabase
        .from('holidays')
        .select('date')
        .gte('date', start)
        .lte('date', end);

      if (holidayError) throw holidayError;
      setHolidays(new Set(holidayData?.map(h => h.date) || []));

      // Fetch global week offs
      const { data: weekOffData, error: weekOffError } = await supabase
        .from('week_offs')
        .select('day_of_week')
        .eq('is_global', true);

      if (weekOffError) throw weekOffError;
      if (weekOffData && weekOffData.length > 0) {
        setWeekOffs(new Set(weekOffData.map(w => w.day_of_week)));
      }
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load attendance data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, selectedEmployee, employees, role, toast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (employees.length > 0) {
      fetchMonthlyData();
    }
  }, [employees, fetchMonthlyData]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayEmployees = selectedEmployee === 'all' 
    ? filteredEmployees 
    : filteredEmployees.filter(e => e.user_id === selectedEmployee);

  const getDayStatus = (date: Date, userId: string): AttendanceRecord | string | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date);

    if (holidays.has(dateStr)) return 'holiday';
    
    const key = `${dateStr}-${userId}`;
    const record = attendance.get(key);
    if (record) return record;

    if (weekOffs.has(dayOfWeek)) return 'week_off';

    // Future dates - no status
    if (isFuture(date)) return null;

    // Past dates with no record = absent (for display only)
    if (!isToday(date)) return 'absent';

    return null;
  };

  const handleEditClick = (record: AttendanceRecord, employeeName: string) => {
    setEditingRecord(record);
    setEditingEmployeeName(employeeName);
    setShowEditDialog(true);
  };

  const handleDayClick = (date: Date, employee: Employee) => {
    const status = getDayStatus(date, employee.user_id);
    
    if (typeof status === 'object' && status !== null) {
      // It's an attendance record - edit it
      handleEditClick(status, employee.full_name);
    } else if (status === 'holiday' || status === 'week_off') {
      toast({
        title: status === 'holiday' ? 'Holiday' : 'Week Off',
        description: `${format(date, 'MMMM d, yyyy')} is a ${status.replace('_', ' ')}`,
      });
    } else if (!isFuture(date)) {
      // No record exists for this past date - could create new
      toast({
        title: 'No Record',
        description: `No attendance record exists for ${employee.full_name} on ${format(date, 'MMMM d, yyyy')}`,
      });
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getStatusBadgeVariant = (status: string): "present" | "absent" | "leave" | "week-off" | "holiday" | "half-day" | "default" => {
    const variants: Record<string, "present" | "absent" | "leave" | "week-off" | "holiday" | "half-day"> = {
      present: 'present',
      absent: 'absent',
      leave: 'leave',
      week_off: 'week-off',
      holiday: 'holiday',
      half_day: 'half-day',
    };
    return variants[status] || 'default';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Monthly Attendance
            </CardTitle>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between">
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

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    All Employees
                  </div>
                </SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {emp.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 text-xs">
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
              <Edit className="w-3 h-3" />
              <span>Click to edit</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-2 sm:px-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[120px]">Employee</TableHead>
                  {days.map(day => (
                    <TableHead 
                      key={day.toString()} 
                      className={`text-center min-w-[36px] p-1 text-xs ${
                        isToday(day) ? 'bg-primary/10' : ''
                      } ${
                        weekOffs.has(getDay(day)) ? 'bg-muted/30' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-muted-foreground">
                          {weekDays[getDay(day)]}
                        </span>
                        <span className={isToday(day) ? 'font-bold text-primary' : ''}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={days.length + 1} className="text-center py-8 text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayEmployees.map(employee => (
                    <TableRow key={employee.user_id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{employee.full_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {employee.department || 'No dept'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      {days.map(day => {
                        const status = getDayStatus(day, employee.user_id);
                        const isRecord = typeof status === 'object' && status !== null;
                        const statusKey = isRecord ? status.status : (status as string);
                        const canClick = !isFuture(day) && statusKey !== 'holiday' && statusKey !== 'week_off';
                        
                        return (
                          <TableCell
                            key={day.toString()}
                            className={`text-center p-0.5 ${canClick && isRecord ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                            onClick={() => canClick && isRecord && handleDayClick(day, employee)}
                          >
                            {statusKey && (
                              <div
                                className={`
                                  w-7 h-7 mx-auto flex items-center justify-center rounded text-[10px] font-bold
                                  ${statusColors[statusKey] || 'bg-muted/30'}
                                  ${isToday(day) ? 'ring-2 ring-primary ring-offset-1' : ''}
                                  ${canClick && isRecord ? 'hover:opacity-80' : ''}
                                `}
                                title={isRecord ? `${statusKey} - Click to edit` : statusKey}
                              >
                                {statusLabels[statusKey] || '-'}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <AttendanceEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        attendance={editingRecord}
        employeeName={editingEmployeeName}
        onUpdate={() => {
          fetchMonthlyData();
          setShowEditDialog(false);
        }}
      />
    </Card>
  );
}
