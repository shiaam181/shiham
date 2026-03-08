import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  LogOut, 
  Users, 
  Calendar,
  
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
  Image as ImageIcon,
  Scan,
  AlertTriangle
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import AppLayout from '@/components/AppLayout';
import DashboardAnalytics from '@/components/DashboardAnalytics';
import AttendanceEditDialog from '@/components/AttendanceEditDialog';
import PhotoThumbnail from '@/components/PhotoThumbnail';
import AttendancePhotoViewer from '@/components/AttendancePhotoViewer';
import EmployeeAttendanceList from '@/components/EmployeeAttendanceList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface Company {
  id: string;
  name: string;
  face_verification_disabled: boolean;
}

export default function AdminDashboard() {
  const { profile, isAdmin, isOwner, isDeveloper, role, signOut, isLoading: authLoading } = useAuth();
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
  const [company, setCompany] = useState<Company | null>(null);

  // Fetch company data for admin's company
  useEffect(() => {
    const fetchCompany = async () => {
      if (!profile?.company_id) return;
      
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, face_verification_disabled')
        .eq('id', profile.company_id)
        .single();
      
      if (!error && data) {
        setCompany(data);
      }
    };

    if (!authLoading && profile?.company_id) {
      fetchCompany();
    }
  }, [authLoading, profile?.company_id]);

  const toggleFaceVerification = async () => {
    if (!company) return;
    
    const newValue = !company.face_verification_disabled;
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({ face_verification_disabled: newValue })
        .eq('id', company.id);

      if (error) throw error;

      setCompany({ ...company, face_verification_disabled: newValue });
      
      toast({
        title: newValue ? 'Face Verification Disabled' : 'Face Verification Enabled',
        description: newValue 
          ? 'Employees can now check in without face verification.'
          : 'Face verification is now required for attendance.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update setting',
        variant: 'destructive',
      });
    }
  };

  const fetchData = useCallback(async () => {
    try {
      // Fetch employees - filter by company for owners
      let employeesQuery = supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true);

      // If owner (not admin or developer), filter to their company only
      if (role === 'owner' && profile?.company_id) {
        employeesQuery = employeesQuery.eq('company_id', profile.company_id);
      }

      const { data: employeesData, error: employeesError } = await employeesQuery;

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Fetch attendance for selected date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', selectedDate);

      if (attendanceError) throw attendanceError;

      // Map employee info to attendance records - filter for company if owner
      const relevantEmployeeIds = new Set(employeesData?.map(e => e.user_id) || []);
      const filteredAttendance = (attendanceData || []).filter(record => 
        role === 'owner' ? relevantEmployeeIds.has(record.user_id) : true
      );

      const attendanceWithEmployees = filteredAttendance.map(record => {
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
  }, [selectedDate, toast, role, profile?.company_id]);

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
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 pb-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="Total Employees"
            value={stats.totalEmployees}
            icon={<Users className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
            iconBg="bg-primary/10"
          />
          <StatCard
            label="Present Today"
            value={stats.presentToday}
            valueColor="text-success"
            icon={<CheckCircle2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-success" />}
            iconBg="bg-success-soft"
          />
          <StatCard
            label="Absent Today"
            value={stats.absentToday}
            valueColor="text-destructive"
            icon={<XCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-destructive" />}
            iconBg="bg-destructive-soft"
          />
          <StatCard
            label="On Leave"
            value={stats.onLeave}
            valueColor="text-info"
            icon={<Calendar className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-info" />}
            iconBg="bg-info-soft"
          />
        </div>

        {/* Analytics Charts */}
        <DashboardAnalytics />

        {/* Attendance Management with Tabs */}
        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
            <TabsTrigger value="daily" className="text-sm">
              <Clock className="w-4 h-4 mr-2" />
              Daily View
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              Monthly View
            </TabsTrigger>
          </TabsList>

          {/* Daily Attendance Tab */}
          <TabsContent value="daily">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex flex-col gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      Daily Attendance
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">View and edit attendance for a specific date</CardDescription>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full sm:w-auto"
                    />
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search employees..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-full sm:w-[200px]"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Department</TableHead>
                        <TableHead className="text-xs sm:text-sm">Check In</TableHead>
                        <TableHead className="text-xs sm:text-sm">Check Out</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Photos</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendance.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                            No attendance records found for this date
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAttendance.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                </div>
                                <span className="font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{record.employee_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs sm:text-sm hidden md:table-cell">
                              {record.employee_department || '-'}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {record.check_in_time 
                                ? format(new Date(record.check_in_time), 'hh:mm a')
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {record.check_out_time 
                                ? format(new Date(record.check_out_time), 'hh:mm a')
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
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
                              <Badge variant={getStatusBadgeVariant(record.status)} className="text-[10px] sm:text-xs">
                                {record.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <AttendancePhotoViewer
                                  record={record}
                                  trigger={
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="w-7 h-7 sm:w-8 sm:h-8"
                                    >
                                      <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </Button>
                                  }
                                />
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="w-7 h-7 sm:w-8 sm:h-8"
                                  onClick={() => {
                                    setEditingRecord(record);
                                    setShowEditDialog(true);
                                  }}
                                >
                                  <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
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
          </TabsContent>

          {/* Monthly Attendance Tab - Employee List */}
          <TabsContent value="monthly">
            <EmployeeAttendanceList />
          </TabsContent>
        </Tabs>

        {/* Company Settings - Face Verification Toggle */}
        {company && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Scan className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Company Settings
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Configure attendance and security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    company.face_verification_disabled ? 'bg-warning/20' : 'bg-success/20'
                  }`}>
                    <Scan className={`w-5 h-5 ${
                      company.face_verification_disabled ? 'text-warning' : 'text-success'
                    }`} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-face-toggle" className="text-sm font-medium cursor-pointer">
                      Face Verification
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {company.face_verification_disabled 
                        ? 'Disabled - employees can check in without face verification'
                        : 'Enabled - employees must verify their face during attendance'
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  id="admin-face-toggle"
                  checked={!company.face_verification_disabled}
                  onCheckedChange={toggleFaceVerification}
                />
              </div>

              {company.face_verification_disabled && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-soft border border-warning/30">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    Face verification is disabled for troubleshooting. Remember to re-enable it for security.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </main>

      {/* Attendance Edit Dialog */}
      <AttendanceEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        attendance={editingRecord}
        employeeName={editingRecord?.employee_name || 'Unknown'}
        onUpdate={fetchData}
      />

    </AppLayout>
  );
}
