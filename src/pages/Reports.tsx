import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, Cell, PieChart, Pie } from 'recharts';
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
  TrendingUp,
  PieChart as PieChartIcon
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, differenceInMinutes } from 'date-fns';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
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
  const location = useLocation();
  const { toast } = useToast();
  
  const fromDeveloper = location.state?.from === 'developer';
  
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
    // Create a professional PDF with company branding
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportDate = format(new Date(), 'MMMM d, yyyy h:mm a');
    const reportPeriod = format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attendance Report - ${reportPeriod}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a2e; line-height: 1.5; }
            
            /* Header with Company Branding */
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a56db; padding-bottom: 20px; margin-bottom: 30px; }
            .company-info { }
            .company-name { font-size: 28px; font-weight: bold; color: #1a56db; margin: 0; }
            .company-tagline { font-size: 12px; color: #666; margin: 5px 0 0 0; }
            .report-meta { text-align: right; font-size: 12px; color: #666; }
            .report-title { font-size: 14px; font-weight: bold; color: #1a1a2e; margin-bottom: 5px; }
            
            /* Report Info */
            .report-info { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; display: flex; justify-content: space-between; }
            .info-item { }
            .info-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
            .info-value { font-size: 16px; font-weight: 600; color: #1a1a2e; }
            
            /* Summary Stats */
            .summary-section { margin-bottom: 30px; }
            .summary-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1a1a2e; }
            .summary-grid { display: flex; gap: 20px; }
            .summary-card { flex: 1; background: linear-gradient(135deg, #f8fafc 0%, #e8eef4 100%); padding: 15px; border-radius: 8px; text-align: center; }
            .summary-value { font-size: 24px; font-weight: bold; }
            .summary-label { font-size: 11px; color: #666; text-transform: uppercase; }
            .summary-value.success { color: #059669; }
            .summary-value.warning { color: #d97706; }
            .summary-value.danger { color: #dc2626; }
            
            /* Table */
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { background: #1a56db; color: white; padding: 12px 10px; text-align: left; font-weight: 600; }
            td { border-bottom: 1px solid #e2e8f0; padding: 10px; }
            tr:nth-child(even) { background: #f8fafc; }
            tr:hover { background: #eef2ff; }
            .text-center { text-align: center; }
            .badge { padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
            .badge-success { background: #d1fae5; color: #059669; }
            .badge-warning { background: #fef3c7; color: #d97706; }
            .badge-danger { background: #fee2e2; color: #dc2626; }
            
            /* Footer with Signatures */
            .footer { margin-top: 60px; page-break-inside: avoid; }
            .signature-section { display: flex; justify-content: space-between; margin-top: 40px; }
            .signature-box { width: 200px; text-align: center; }
            .signature-line { border-top: 2px solid #1a1a2e; padding-top: 10px; margin-top: 60px; }
            .signature-name { font-weight: 600; font-size: 12px; }
            .signature-title { font-size: 10px; color: #666; }
            
            .footer-note { text-align: center; font-size: 10px; color: #999; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
            
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <!-- Company Header -->
          <div class="header">
            <div class="company-info">
              <h1 class="company-name">AttendanceHub</h1>
              <p class="company-tagline">Employee Attendance Management System</p>
            </div>
            <div class="report-meta">
              <div class="report-title">ATTENDANCE REPORT</div>
              <div>Generated: ${reportDate}</div>
              <div>Report ID: ATT-${format(new Date(), 'yyyyMMddHHmm')}</div>
            </div>
          </div>
          
          <!-- Report Info -->
          <div class="report-info">
            <div class="info-item">
              <div class="info-label">Report Period</div>
              <div class="info-value">${reportPeriod}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Total Employees</div>
              <div class="info-value">${totalStats.totalEmployees}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Average Attendance</div>
              <div class="info-value">${totalStats.avgAttendance}%</div>
            </div>
            <div class="info-item">
              <div class="info-label">Working Days</div>
              <div class="info-value">${stats[0]?.totalDays || '-'}</div>
            </div>
          </div>
          
          <!-- Summary Statistics -->
          <div class="summary-section">
            <div class="summary-title">Summary Statistics</div>
            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-value success">${totalStats.avgAttendance}%</div>
                <div class="summary-label">Avg Attendance</div>
              </div>
              <div class="summary-card">
                <div class="summary-value warning">${totalStats.totalLateCheckIns}</div>
                <div class="summary-label">Late Check-ins</div>
              </div>
              <div class="summary-card">
                <div class="summary-value danger">${totalStats.totalAbsent}</div>
                <div class="summary-label">Total Absences</div>
              </div>
            </div>
          </div>
          
          <!-- Detailed Table -->
          <div class="summary-title">Employee Attendance Details</div>
          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Department</th>
                <th class="text-center">Present</th>
                <th class="text-center">Absent</th>
                <th class="text-center">Leave</th>
                <th class="text-center">Late</th>
                <th class="text-center">Early Out</th>
                <th class="text-center">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              ${stats.map(s => `
                <tr>
                  <td><strong>${s.employee.full_name}</strong></td>
                  <td>${s.employee.department || '-'}</td>
                  <td class="text-center"><span class="badge badge-success">${s.present}</span></td>
                  <td class="text-center"><span class="badge badge-danger">${s.absent}</span></td>
                  <td class="text-center">${s.leave}</td>
                  <td class="text-center"><span class="badge badge-warning">${s.lateCheckIns}</span></td>
                  <td class="text-center"><span class="badge badge-warning">${s.earlyCheckOuts}</span></td>
                  <td class="text-center"><span class="badge ${s.attendancePercentage >= 90 ? 'badge-success' : s.attendancePercentage >= 75 ? 'badge-warning' : 'badge-danger'}">${s.attendancePercentage}%</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <!-- Signature Section -->
          <div class="footer">
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line">
                  <div class="signature-name">Prepared By</div>
                  <div class="signature-title">HR Department</div>
                </div>
              </div>
              <div class="signature-box">
                <div class="signature-line">
                  <div class="signature-name">Reviewed By</div>
                  <div class="signature-title">Department Manager</div>
                </div>
              </div>
              <div class="signature-box">
                <div class="signature-line">
                  <div class="signature-name">Approved By</div>
                  <div class="signature-title">HR Director</div>
                </div>
              </div>
            </div>
            
            <div class="footer-note">
              This is a computer-generated report from AttendanceHub. 
              For any discrepancies, please contact the HR department.
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();

    toast({ title: 'Success', description: 'Professional PDF report generated' });
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
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-6">
        <PageHeader
          title="Attendance Reports"
          description="Monthly analytics & export"
          icon={<BarChart3 className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-info" />}
        />
            
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5">
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full sm:w-auto"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToCSV} className="flex-1 sm:flex-initial text-xs sm:text-sm">
                  <FileSpreadsheet className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Export </span>CSV
                </Button>
                <Button size="sm" onClick={exportToPDF} className="flex-1 sm:flex-initial text-xs sm:text-sm">
                  <FileText className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Export </span>PDF
                </Button>
              </div>
        </div>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <Card className="p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Employees</p>
                <p className="text-xl sm:text-3xl font-display font-bold mt-1">{totalStats.totalEmployees}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Avg Attendance</p>
                <p className="text-xl sm:text-3xl font-display font-bold mt-1 text-success">{totalStats.avgAttendance}%</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-success-soft flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Late Check-ins</p>
                <p className="text-xl sm:text-3xl font-display font-bold mt-1 text-warning">{totalStats.totalLateCheckIns}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-warning-soft flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Absences</p>
                <p className="text-xl sm:text-3xl font-display font-bold mt-1 text-destructive">{totalStats.totalAbsent}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-destructive-soft flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
              </div>
            </div>
          </Card>
        </div>

        {/* Visual Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Attendance Distribution Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-primary" />
                Attendance Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const totalPresent = stats.reduce((a, s) => a + s.present, 0);
                const totalLeave = stats.reduce((a, s) => a + s.leave, 0);
                const pieData = [
                  { name: 'Present', value: totalPresent, fill: 'hsl(var(--chart-1))' },
                  { name: 'Absent', value: totalStats.totalAbsent, fill: 'hsl(var(--chart-2))' },
                  { name: 'Leave', value: totalLeave, fill: 'hsl(var(--chart-3))' },
                ].filter(d => d.value > 0);
                return (
                  <>
                    <ChartContainer config={{ value: { label: 'Days' } }} className="h-[180px] w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={2}>
                          {pieData.map(e => <Cell key={e.name} fill={e.fill} />)}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="flex justify-center gap-4 mt-1">
                      {pieData.map(d => (
                        <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Top 5 Performers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const top5 = stats.slice(0, 5).map(s => ({
                  name: s.employee.full_name.split(' ')[0],
                  pct: s.attendancePercentage,
                  fill: s.attendancePercentage >= 90 ? 'hsl(var(--chart-1))' : s.attendancePercentage >= 75 ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-2))',
                }));
                return (
                  <ChartContainer config={{ pct: { label: 'Attendance %' } }} className="h-[200px] w-full">
                    <BarChart data={top5} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" fontSize={11} tickLine={false} axisLine={false} width={60} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                        {top5.map(e => <Cell key={e.name} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Report Tabs */}
        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
            <TabsTrigger value="attendance" className="text-xs sm:text-sm">
              <Calendar className="w-3.5 h-3.5 mr-1.5" /> Attendance
            </TabsTrigger>
            <TabsTrigger value="leave" className="text-xs sm:text-sm">
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Leave Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Monthly Attendance Summary
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')} - {stats.length} employees
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Department</TableHead>
                        <TableHead className="text-xs sm:text-sm text-center">Present</TableHead>
                        <TableHead className="text-xs sm:text-sm text-center">Absent</TableHead>
                        <TableHead className="text-xs sm:text-sm text-center hidden sm:table-cell">Leave</TableHead>
                        <TableHead className="text-xs sm:text-sm text-center hidden lg:table-cell">Late</TableHead>
                        <TableHead className="text-xs sm:text-sm text-center hidden lg:table-cell">Early Out</TableHead>
                        <TableHead className="text-xs sm:text-sm text-center">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                            No data available for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        stats.map((stat) => (
                          <TableRow key={stat.employee.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">
                              <span className="truncate max-w-[80px] sm:max-w-none block">{stat.employee.full_name}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs sm:text-sm hidden md:table-cell">
                              {stat.employee.department || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="success-soft" className="text-[10px] sm:text-xs">{stat.present}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="destructive-soft" className="text-[10px] sm:text-xs">{stat.absent}</Badge>
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell">
                              <Badge variant="info-soft" className="text-[10px] sm:text-xs">{stat.leave}</Badge>
                            </TableCell>
                            <TableCell className="text-center hidden lg:table-cell">
                              <Badge variant="warning-soft" className="text-[10px] sm:text-xs">{stat.lateCheckIns}</Badge>
                            </TableCell>
                            <TableCell className="text-center hidden lg:table-cell">
                              <Badge variant="warning-soft" className="text-[10px] sm:text-xs">{stat.earlyCheckOuts}</Badge>
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
                                className="text-[10px] sm:text-xs"
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
          </TabsContent>

          <TabsContent value="leave">
            <LeaveSummaryTab selectedMonth={selectedMonth} />
          </TabsContent>
        </Tabs>
      </main>
    </AppLayout>
  );
}

/* Leave Summary Sub-component */
function LeaveSummaryTab({ selectedMonth }: { selectedMonth: string }) {
  const [leaveData, setLeaveData] = useState<{ user_id: string; name: string; dept: string; type: string; status: string; start: string; end: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaves = async () => {
      setLoading(true);
      const monthDate = parseISO(`${selectedMonth}-01`);
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      const [leavesRes, profilesRes] = await Promise.all([
        supabase.from('leave_requests').select('user_id, leave_type, status, start_date, end_date')
          .gte('start_date', startDate).lte('start_date', endDate),
        supabase.from('profiles').select('user_id, full_name, department').eq('is_active', true),
      ]);

      const profiles = profilesRes.data || [];
      const mapped = (leavesRes.data || []).map(l => {
        const p = profiles.find(pr => pr.user_id === l.user_id);
        return {
          user_id: l.user_id,
          name: p?.full_name || 'Unknown',
          dept: p?.department || '-',
          type: l.leave_type,
          status: l.status,
          start: l.start_date,
          end: l.end_date,
        };
      });
      setLeaveData(mapped);
      setLoading(false);
    };
    fetchLeaves();
  }, [selectedMonth]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const statusCounts = leaveData.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  const typeCounts = leaveData.reduce<Record<string, number>>((acc, l) => {
    acc[l.type] = (acc[l.type] || 0) + 1;
    return acc;
  }, {});

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const typeChartData = Object.entries(typeCounts).map(([type, count], i) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    count,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase">Total Requests</p>
          <p className="text-lg font-bold">{leaveData.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase">Approved</p>
          <p className="text-lg font-bold text-success">{statusCounts['approved'] || 0}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
          <p className="text-lg font-bold text-warning">{statusCounts['pending'] || 0}</p>
        </Card>
      </div>

      {/* Leave type chart */}
      {typeChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" /> Leave by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ count: { label: 'Requests' } }} className="h-[180px] w-full">
              <BarChart data={typeChartData}>
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {typeChartData.map(e => <Cell key={e.name} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Leave requests table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Employee</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Department</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Dates</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveData.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No leave requests this month</TableCell></TableRow>
                ) : leaveData.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{l.name}</TableCell>
                    <TableCell className="text-xs hidden sm:table-cell text-muted-foreground">{l.dept}</TableCell>
                    <TableCell className="text-xs capitalize">{l.type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(l.start), 'dd MMM')} - {format(parseISO(l.end), 'dd MMM')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={l.status === 'approved' ? 'success-soft' : l.status === 'rejected' ? 'destructive-soft' : 'warning-soft'}
                        className="text-[10px]"
                      >
                        {l.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
