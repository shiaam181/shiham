import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  MapPin, 
  Camera, 
  Calendar,
  ChevronRight,
  User,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sun,
  Sunset,
  Settings,
  FileText,
  Timer
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import AttendanceCalendar from '@/components/AttendanceCalendar';
import CameraCapture from '@/components/CameraCapture';
import LeaveRequestForm from '@/components/LeaveRequestForm';
import MobileBottomNav from '@/components/MobileBottomNav';
import LeaveNotifications from '@/components/LeaveNotifications';
import { calculateOvertime, formatDuration } from '@/lib/overtime';

interface TodayAttendance {
  id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  check_in_photo_url: string | null;
  check_out_photo_url: string | null;
}

interface AttendanceStats {
  present: number;
  absent: number;
  leave: number;
  total: number;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function EmployeeDashboard() {
  const { user, profile, isAdmin, signOut, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<AttendanceStats>({ present: 0, absent: 0, leave: 0, total: 0 });
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [captureType, setCaptureType] = useState<'check-in' | 'check-out'>('check-in');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setLocationError('Location access denied. Please enable GPS.');
        }
      );
    }
  }, []);

  const fetchTodayAttendance = useCallback(async () => {
    if (!user) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;
      setTodayAttendance(data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  }, [user]);

  const fetchMonthlyStats = useCallback(async () => {
    if (!user) return;
    
    try {
      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('attendance')
        .select('status')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);

      if (error) throw error;

      const stats = {
        present: data?.filter(a => a.status === 'present').length || 0,
        absent: data?.filter(a => a.status === 'absent').length || 0,
        leave: data?.filter(a => a.status === 'leave').length || 0,
        total: data?.length || 0,
      };
      setMonthlyStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchLeaveRequests = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTodayAttendance();
      fetchMonthlyStats();
      fetchLeaveRequests();
    }
  }, [user, fetchTodayAttendance, fetchMonthlyStats, fetchLeaveRequests]);

  const handleCheckIn = () => {
    setCaptureType('check-in');
    setShowCamera(true);
  };

  const handleCheckOut = () => {
    setCaptureType('check-out');
    setShowCamera(true);
  };

  const handleCameraCapture = async (photoDataUrl: string, faceVerified: boolean) => {
    setShowCamera(false);
    
    if (!user || !location) {
      toast({
        title: 'Error',
        description: 'Please enable location access to mark attendance.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();

      if (captureType === 'check-in') {
        const { error } = await supabase.from('attendance').insert({
          user_id: user.id,
          date: today,
          check_in_time: now,
          check_in_latitude: location.lat,
          check_in_longitude: location.lng,
          check_in_photo_url: photoDataUrl,
          check_in_face_verified: faceVerified,
          status: 'present',
        });

        if (error) throw error;

        toast({
          title: 'Checked In!',
          description: `You checked in at ${format(new Date(), 'hh:mm a')}`,
        });
      } else {
        const { error } = await supabase
          .from('attendance')
          .update({
            check_out_time: now,
            check_out_latitude: location.lat,
            check_out_longitude: location.lng,
            check_out_photo_url: photoDataUrl,
            check_out_face_verified: faceVerified,
          })
          .eq('user_id', user.id)
          .eq('date', today);

        if (error) throw error;

        toast({
          title: 'Checked Out!',
          description: `You checked out at ${format(new Date(), 'hh:mm a')}`,
        });
      }

      fetchTodayAttendance();
      fetchMonthlyStats();
    } catch (error: any) {
      console.error('Attendance error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark attendance',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good Morning', icon: Sun };
    if (hour < 17) return { text: 'Good Afternoon', icon: Sun };
    return { text: 'Good Evening', icon: Sunset };
  };

  const greeting = getGreeting();
  const hasCheckedIn = !!todayAttendance?.check_in_time;
  const hasCheckedOut = !!todayAttendance?.check_out_time;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">AttendanceHub</h1>
                <p className="text-xs text-muted-foreground">Employee Portal</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="hidden sm:flex"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Panel
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/profile')}
                title="Profile Settings"
              >
                <Settings className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{profile?.department || 'Employee'}</p>
                </div>
              </div>
              
              <Button variant="ghost" size="icon" onClick={signOut}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Greeting & Time */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <greeting.icon className="w-5 h-5" />
              <span className="text-sm">{greeting.text}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold">
              {profile?.full_name?.split(' ')[0] || 'User'}!
            </h2>
          </div>
          
          <div className="text-right">
            <p className="text-4xl font-display font-bold text-primary">
              {format(currentTime, 'hh:mm')}
              <span className="text-lg text-muted-foreground ml-1">{format(currentTime, 'a')}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {format(currentTime, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>

        {/* Location Status */}
        {locationError && (
          <Card className="border-warning/30 bg-warning-soft">
            <CardContent className="py-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              <p className="text-sm text-warning">{locationError}</p>
            </CardContent>
          </Card>
        )}

        {/* Check In/Out Card */}
        <Card variant="elevated" className="overflow-hidden">
          <div className="gradient-hero p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-lg">Today's Attendance</h3>
                <p className="text-white/80 text-sm">{format(new Date(), 'MMMM d, yyyy')}</p>
              </div>
              
              {todayAttendance && (
                <Badge 
                  variant={hasCheckedOut ? 'success' : hasCheckedIn ? 'warning' : 'secondary'}
                  className="text-sm"
                >
                  {hasCheckedOut ? 'Completed' : hasCheckedIn ? 'In Progress' : 'Not Started'}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <LogIn className="w-4 h-4" />
                  <span className="text-sm text-white/80">Check In</span>
                </div>
                {hasCheckedIn ? (
                  <p className="text-2xl font-display font-bold">
                    {format(new Date(todayAttendance!.check_in_time!), 'hh:mm a')}
                  </p>
                ) : (
                  <p className="text-lg text-white/60">Not yet</p>
                )}
              </div>
              
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm text-white/80">Check Out</span>
                </div>
                {hasCheckedOut ? (
                  <p className="text-2xl font-display font-bold">
                    {format(new Date(todayAttendance!.check_out_time!), 'hh:mm a')}
                  </p>
                ) : (
                  <p className="text-lg text-white/60">Not yet</p>
                )}
              </div>
            </div>

            {location && (
              <div className="flex items-center gap-2 text-white/80 text-sm mb-4">
                <MapPin className="w-4 h-4" />
                <span>Location verified: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
              </div>
            )}
          </div>

          <CardContent className="p-6">
            {!hasCheckedIn ? (
              <Button 
                variant="check-in" 
                size="xl" 
                className="w-full"
                onClick={handleCheckIn}
                disabled={!location}
              >
                <Camera className="w-5 h-5 mr-2" />
                Check In Now
              </Button>
            ) : !hasCheckedOut ? (
              <Button 
                variant="check-out" 
                size="xl" 
                className="w-full"
                onClick={handleCheckOut}
                disabled={!location}
              >
                <Camera className="w-5 h-5 mr-2" />
                Check Out Now
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-3 py-4 text-success">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-semibold text-lg">Attendance Complete for Today</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success-soft flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{monthlyStats.present}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive-soft flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{monthlyStats.absent}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info-soft flex items-center justify-center">
                <Calendar className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{monthlyStats.leave}</p>
                <p className="text-xs text-muted-foreground">Leave</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {monthlyStats.total > 0 
                    ? Math.round((monthlyStats.present / monthlyStats.total) * 100) 
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Attendance</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Calendar */}
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Monthly Overview
            </CardTitle>
            <CardDescription>Your attendance for {format(new Date(), 'MMMM yyyy')}</CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceCalendar userId={user?.id} />
          </CardContent>
        </Card>

        {/* Leave Requests */}
        <LeaveRequestForm leaveRequests={leaveRequests} onRefresh={fetchLeaveRequests} />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card 
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/profile')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Profile Settings</p>
                <p className="text-xs text-muted-foreground">Update photo & details</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </div>
          </Card>
          
          {!profile?.face_reference_url && (
            <Card 
              className="p-4 cursor-pointer hover:shadow-elevated transition-shadow border-warning/50 bg-warning-soft"
              onClick={() => navigate('/profile')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium text-warning">Setup Face Verification</p>
                  <p className="text-xs text-warning/80">Required for attendance</p>
                </div>
                <ChevronRight className="w-5 h-5 ml-auto text-warning" />
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Leave Notifications (realtime) */}
      <LeaveNotifications onLeaveUpdate={fetchLeaveRequests} />

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          type={captureType}
          referenceImageUrl={profile?.face_reference_url}
        />
      )}

      {/* Bottom padding for mobile nav */}
      <div className="h-16 sm:hidden" />
    </div>
  );
}
