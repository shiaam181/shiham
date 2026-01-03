import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  LogOut, 
  Users, 
  Calendar,
  ChevronRight,
  User,
  Shield,
  CheckCircle2,
  XCircle,
  Search,
  MapPin,
  Eye,
  Edit,
  BarChart3,
  Settings,
  Timer,
  Bell,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import MobileBottomNav from '@/components/MobileBottomNav';
import NotificationBell from '@/components/NotificationBell';
import AttendanceEditDialog from '@/components/AttendanceEditDialog';
import PhotoThumbnail from '@/components/PhotoThumbnail';
import AttendancePhotoViewer from '@/components/AttendancePhotoViewer';
import { calculateOvertime, formatDuration } from '@/lib/overtime';

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  check_in_photo_url: string | null;
  check_out_photo_url: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  notes: string | null;
  admin_notes: string | null;
  overtime_minutes: number | null;
  employee_name?: string;
  employee_department?: string;
}

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeave: number;
}

export default function AdminDashboard() {
  const { profile, isAdmin, signOut, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    onLeave: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch all employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true);

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Fetch attendance for selected date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', selectedDate);

      if (attendanceError) throw attendanceError;

      // Map employee info to attendance records
      const attendanceWithEmployees = (attendanceData || []).map(record => {
        const employee = employeesData?.find(e => e.user_id === record.user_id);
        return {
          ...record,
          employee_name: employee?.full_name || 'Unknown',
          employee_department: employee?.department || null,
        };
      });

      setTodayAttendance(attendanceWithEmployees);

      // Calculate stats
      const present = attendanceData?.filter(a => a.status === 'present').length || 0;
      const leave = attendanceData?.filter(a => a.status === 'leave').length || 0;
      const total = employeesData?.length || 0;

      setStats({
        totalEmployees: total,
        presentToday: present,
        absentToday: total - present - leave,
        onLeave: leave,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, toast]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [authLoading, isAdmin, navigate, fetchData]);

  const filteredAttendance = todayAttendance.filter(record => 
    record.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.employee_department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-sidebar text-sidebar-foreground">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">Admin Dashboard</h1>
                <p className="text-xs text-sidebar-foreground/70">AttendanceHub Management</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <User className="w-4 h-4 mr-2" />
                Employee View
              </Button>
              
              <NotificationBell />
              
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className="text-xs text-sidebar-foreground/70">Administrator</p>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={signOut}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-3xl font-display font-bold mt-1">{stats.totalEmployees}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Present Today</p>
                <p className="text-3xl font-display font-bold mt-1 text-success">{stats.presentToday}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-success-soft flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Absent Today</p>
                <p className="text-3xl font-display font-bold mt-1 text-destructive">{stats.absentToday}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive-soft flex items-center justify-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On Leave</p>
                <p className="text-3xl font-display font-bold mt-1 text-info">{stats.onLeave}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-info-soft flex items-center justify-center">
                <Calendar className="w-6 h-6 text-info" />
              </div>
            </div>
          </Card>
        </div>

        {/* Today's Attendance */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Attendance Records
                </CardTitle>
                <CardDescription>View and manage employee attendance</CardDescription>
              </div>
              
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Photos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No attendance records found for this date
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <span className="font-medium">{record.employee_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.employee_department || '-'}
                        </TableCell>
                        <TableCell>
                          {record.check_in_time 
                            ? format(new Date(record.check_in_time), 'hh:mm a')
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {record.check_out_time 
                            ? format(new Date(record.check_out_time), 'hh:mm a')
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PhotoThumbnail 
                              photoUrl={record.check_in_photo_url} 
                              alt={`${record.employee_name} check-in`}
                            />
                            <PhotoThumbnail 
                              photoUrl={record.check_out_photo_url} 
                              alt={`${record.employee_name} check-out`}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(record.status)}>
                            {record.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <AttendancePhotoViewer
                              record={record}
                              trigger={
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              }
                            />
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setEditingRecord(record);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card 
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/admin/employees')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Manage Employees</p>
                <p className="text-xs text-muted-foreground">Add, edit, deactivate</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </div>
          </Card>
          
          <Card 
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/admin/holidays')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning-soft flex items-center justify-center">
                <Calendar className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="font-medium">Holidays</p>
                <p className="text-xs text-muted-foreground">Manage company holidays</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </div>
          </Card>
          
          <Card 
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/admin/reports')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info-soft flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="font-medium">Reports</p>
                <p className="text-xs text-muted-foreground">Export attendance data</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </div>
          </Card>
          
          <Card 
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/admin/shifts')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="font-medium">Shift Management</p>
                <p className="text-xs text-muted-foreground">Create & assign shifts</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </div>
          </Card>
          
          <Card 
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/admin/leaves')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success-soft flex items-center justify-center">
                <Calendar className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-medium">Leave Requests</p>
                <p className="text-xs text-muted-foreground">Approve or reject leaves</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </div>
          </Card>
          
          <Card 
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/admin/weekoffs')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Weekly Offs</p>
                <p className="text-xs text-muted-foreground">Configure week off days</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </div>
          </Card>
          <Card 
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/admin/settings')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Company Settings</p>
                <p className="text-xs text-muted-foreground">Configure company info</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </div>
          </Card>
        </div>
      </main>

      {/* Attendance Edit Dialog */}
      <AttendanceEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        attendance={editingRecord}
        employeeName={editingRecord?.employee_name || 'Unknown'}
        onUpdate={fetchData}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
      
      {/* Bottom padding for mobile nav */}
      <div className="h-16 sm:hidden" />
    </div>
  );
}
