import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, differenceInMinutes } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  department: string | null;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
}

interface EmployeeStats {
  employee: Employee;
  present: number;
  absent: number;
  leave: number;
  lateCheckIns: number;
  earlyCheckOuts: number;
  totalDays: number;
  attendancePercentage: number;
}

export default function Reports() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<EmployeeStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(true);
  const [shiftStartTime, setShiftStartTime] = useState('09:00');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const monthDate = parseISO(`${selectedMonth}-01`);
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, department')
        .eq('is_active', true);

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Fetch attendance for the month
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (attendanceError) throw attendanceError;
      setAttendance(attendanceData || []);

      // Fetch default shift time
      const { data: shiftData } = await supabase
        .from('shifts')
        .select('start_time')
        .eq('is_default', true)
        .maybeSingle();

      if (shiftData?.start_time) {
        setShiftStartTime(shiftData.start_time);
      }

      // Calculate stats for each employee
      const workingDays = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) })
        .filter(day => day.getDay() !== 0 && day.getDay() !== 6).length;

      const employeeStats: EmployeeStats[] = (employeesData || []).map(emp => {
        const empAttendance = (attendanceData || []).filter(a => a.user_id === emp.user_id);
        const present = empAttendance.filter(a => a.status === 'present').length;
        const leave = empAttendance.filter(a => a.status === 'leave').length;
        const absent = workingDays - present - leave;

        // Calculate late check-ins
        const lateCheckIns = empAttendance.filter(a => {
          if (!a.check_in_time) return false;
          const checkInTime = new Date(a.check_in_time);
          const [shiftHour, shiftMin] = (shiftData?.start_time || '09:00').split(':');
          const expectedTime = new Date(a.check_in_time);
          expectedTime.setHours(parseInt(shiftHour), parseInt(shiftMin), 0, 0);
          return checkInTime > expectedTime;
        }).length;

        // Calculate early check-outs (before 6 PM)
        const earlyCheckOuts = empAttendance.filter(a => {
          if (!a.check_out_time) return false;
          const checkOutTime = new Date(a.check_out_time);
          const expectedTime = new Date(a.check_out_time);
          expectedTime.setHours(18, 0, 0, 0);
          return checkOutTime < expectedTime;
        }).length;

        return {
          employee: emp,
          present,
          absent: Math.max(0, absent),
          leave,
          lateCheckIns,
          earlyCheckOuts,
          totalDays: workingDays,
          attendancePercentage: workingDays > 0 ? Math.round((present / workingDays) * 100) : 0,
        };
      });

      setStats(employeeStats.sort((a, b) => b.attendancePercentage - a.attendancePercentage));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load report data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, toast]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [authLoading, isAdmin, navigate, fetchData]);

  const exportToCSV = () => {
    const headers = ['Employee', 'Department', 'Present', 'Absent', 'Leave', 'Late Check-ins', 'Early Check-outs', 'Attendance %'];
    const rows = stats.map(s => [
      s.employee.full_name,
      s.employee.department || '-',
      s.present,
      s.absent,
      s.leave,
      s.lateCheckIns,
      s.earlyCheckOuts,
      `${s.attendancePercentage}%`
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Success', description: 'Report exported to CSV' });
  };

  const exportToPDF = () => {
    // Create a simple HTML table and print it
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attendance Report - ${format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1a56db; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f3f4f6; }
            .good { color: #059669; }
            .warning { color: #d97706; }
            .bad { color: #dc2626; }
          </style>
        </head>
        <body>
          <h1>Attendance Report</h1>
          <p>Period: ${format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</p>
          <p>Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Leave</th>
                <th>Late</th>
                <th>Early Out</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              ${stats.map(s => `
                <tr>
                  <td>${s.employee.full_name}</td>
                  <td>${s.employee.department || '-'}</td>
                  <td class="good">${s.present}</td>
                  <td class="bad">${s.absent}</td>
                  <td>${s.leave}</td>
                  <td class="warning">${s.lateCheckIns}</td>
                  <td class="warning">${s.earlyCheckOuts}</td>
                  <td class="${s.attendancePercentage >= 90 ? 'good' : s.attendancePercentage >= 75 ? 'warning' : 'bad'}">${s.attendancePercentage}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();

    toast({ title: 'Success', description: 'Report exported to PDF' });
  };

  const totalStats = {
    totalEmployees: stats.length,
    avgAttendance: stats.length > 0 ? Math.round(stats.reduce((acc, s) => acc + s.attendancePercentage, 0) / stats.length) : 0,
    totalLateCheckIns: stats.reduce((acc, s) => acc + s.lateCheckIns, 0),
    totalAbsent: stats.reduce((acc, s) => acc + s.absent, 0),
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-info-soft flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-info" />
                </div>
                <div>
                  <h1 className="font-display font-bold text-lg">Attendance Reports</h1>
                  <p className="text-xs text-muted-foreground">Monthly analytics & export</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-auto"
              />
              <Button variant="outline" onClick={exportToCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="hero" onClick={exportToPDF}>
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-3xl font-display font-bold mt-1">{totalStats.totalEmployees}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Attendance</p>
                <p className="text-3xl font-display font-bold mt-1 text-success">{totalStats.avgAttendance}%</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-success-soft flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Late Check-ins</p>
                <p className="text-3xl font-display font-bold mt-1 text-warning">{totalStats.totalLateCheckIns}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning-soft flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Absences</p>
                <p className="text-3xl font-display font-bold mt-1 text-destructive">{totalStats.totalAbsent}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive-soft flex items-center justify-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </Card>
        </div>

        {/* Detailed Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Monthly Attendance Summary
            </CardTitle>
            <CardDescription>
              {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')} - {stats.length} employees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Leave</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Early Out</TableHead>
                    <TableHead className="text-center">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No data available for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.map((stat) => (
                      <TableRow key={stat.employee.id}>
                        <TableCell className="font-medium">{stat.employee.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {stat.employee.department || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="success-soft">{stat.present}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive-soft">{stat.absent}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="info-soft">{stat.leave}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="warning-soft">{stat.lateCheckIns}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="warning-soft">{stat.earlyCheckOuts}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={
                              stat.attendancePercentage >= 90 
                                ? 'success' 
                                : stat.attendancePercentage >= 75 
                                  ? 'warning' 
                                  : 'destructive'
                            }
                          >
                            {stat.attendancePercentage}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
