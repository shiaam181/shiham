import { useEffect, useState, useCallback } from 'react';
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
  Timer,
  Code,
  Loader2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import AttendanceCalendar from '@/components/AttendanceCalendar';
import CameraCapture from '@/components/CameraCapture';
import LeaveRequestForm from '@/components/LeaveRequestForm';
import MobileBottomNav from '@/components/MobileBottomNav';
import LeaveNotifications from '@/components/LeaveNotifications';
import NotificationBell from '@/components/NotificationBell';
import OvertimeChart from '@/components/OvertimeChart';
import EmployeeAttendancePDF from '@/components/EmployeeAttendancePDF';
import RoleBasedHeader from '@/components/RoleBasedHeader';
import LocationDisplay from '@/components/LocationDisplay';
import { useLiveTracking } from '@/hooks/useLiveTracking';
import { calculateOvertime, formatDuration, getRemainingTime, isApproaching24Hours } from '@/lib/overtime';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { hasAwsRekognitionRegistration, hasFaceEmbedding } from '@/lib/faceEmbedding';
import { 
  generateChallengeToken, 
  verifyAttendance, 
  getCurrentPosition,
  ChallengeToken 
} from '@/lib/faceVerificationService';
import { loadFaceModels } from '@/lib/faceRecognition';

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
  const { user, profile, isAdmin, isDeveloper, signOut, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<AttendanceStats>({ present: 0, absent: 0, leave: 0, total: 0 });
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [captureType, setCaptureType] = useState<'check-in' | 'check-out'>('check-in');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lng: number; timestamp: string; accuracy: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitiatingAttendance, setIsInitiatingAttendance] = useState(false);
  const [challengeToken, setChallengeToken] = useState<ChallengeToken | null>(null);
  const { settings: systemSettings, isLoading: settingsLoading } = useSystemSettings();
  const { canTrack, startTrackingSilent, stopTrackingSilent } = useLiveTracking();

  // Preload face models in background for faster camera startup
  // Non-blocking - if it fails, we'll handle it when camera opens
  useEffect(() => {
    if (systemSettings.faceVerificationEnabled || systemSettings.photoCaptureEnabled) {
      // Use requestIdleCallback for better mobile performance, fallback to setTimeout
      const loadModels = () => {
        loadFaceModels().catch((err) => {
          console.warn('Background face model loading failed (will retry when needed):', err.message);
        });
      };
      
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(loadModels, { timeout: 5000 });
      } else {
        setTimeout(loadModels, 1000);
      }
    }
  }, [systemSettings.faceVerificationEnabled, systemSettings.photoCaptureEnabled]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get fresh GPS position when needed
  const refreshLocation = useCallback(async () => {
    if (!systemSettings.gpsTrackingEnabled) {
      setLocation({ lat: 0, lng: 0, timestamp: new Date().toISOString(), accuracy: 0 });
      setLocationError(null);
      return;
    }

    try {
      const pos = await getCurrentPosition();
      setLocation({
        lat: pos.latitude,
        lng: pos.longitude,
        timestamp: pos.timestamp,
        accuracy: pos.accuracy,
      });
      setLocationError(null);
    } catch (error: any) {
      console.error('Location error:', error);
      setLocationError(error.message || 'Location access denied. Please enable GPS.');
    }
  }, [systemSettings.gpsTrackingEnabled]);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

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

  // Initiate check-in/check-out with production verification
  const initiateAttendance = async (type: 'check-in' | 'check-out') => {
    setIsInitiatingAttendance(true);
    
    try {
      // If face verification is enabled but the user's face data is still legacy/outdated,
      // don't start the attendance flow (it will fail with FACE_OUTDATED).
      if (systemSettings.faceVerificationEnabled && !hasAwsRekognitionRegistration(profile?.face_embedding)) {
        toast({
          title: 'Face Setup Required',
          description: 'Your face registration is outdated. Please re-register your face to continue.',
          variant: 'destructive',
        });
        navigate('/face-setup');
        return;
      }

      // Run GPS refresh and challenge token generation in parallel for speed
      const tasks: Promise<any>[] = [];
      
      if (systemSettings.gpsTrackingEnabled) {
        tasks.push(refreshLocation());
      }
      
      if (systemSettings.faceVerificationEnabled) {
        tasks.push(generateChallengeToken().then(token => setChallengeToken(token)));
      }
      
      // Wait for all parallel tasks
      await Promise.all(tasks);
      
      // Check if GPS failed (location would be null if it did)
      if (systemSettings.gpsTrackingEnabled && !location && locationError) {
        toast({
          title: 'GPS Required',
          description: locationError || 'Please enable GPS to mark attendance.',
          variant: 'destructive',
        });
        return;
      }

      setCaptureType(type);
      
      if (systemSettings.photoCaptureEnabled) {
        setShowCamera(true);
      } else {
        // Direct attendance without camera
        await handleDirectAttendance(type);
      }
    } catch (error: any) {
      console.error('Attendance initiation error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to initialize. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsInitiatingAttendance(false);
    }
  };

  const handleCheckIn = () => initiateAttendance('check-in');
  const handleCheckOut = () => initiateAttendance('check-out');

  // Handle direct attendance (no camera required)
  const handleDirectAttendance = async (type: 'check-in' | 'check-out') => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();

      if (type === 'check-in') {
        const { error } = await supabase.from('attendance').insert({
          user_id: user.id,
          date: today,
          check_in_time: now,
          check_in_latitude: systemSettings.gpsTrackingEnabled ? location?.lat : null,
          check_in_longitude: systemSettings.gpsTrackingEnabled ? location?.lng : null,
          check_in_photo_url: null,
          check_in_face_verified: !systemSettings.faceVerificationEnabled,
          status: 'present',
          gps_timestamp: location?.timestamp || null,
        });

        if (error) throw error;

        toast({
          title: 'Checked In!',
          description: `You checked in at ${format(new Date(), 'hh:mm a')}`,
        });

        // Auto-start live tracking on check-in
        if (canTrack) {
          startTrackingSilent();
          toast({
            title: '📍 Live Location Tracking Started',
            description: 'Your live location is now being shared with your company.',
          });
        }
      } else {
        const { error } = await supabase
          .from('attendance')
          .update({
            check_out_time: now,
            check_out_latitude: systemSettings.gpsTrackingEnabled ? location?.lat : null,
            check_out_longitude: systemSettings.gpsTrackingEnabled ? location?.lng : null,
            check_out_photo_url: null,
            check_out_face_verified: !systemSettings.faceVerificationEnabled,
          })
          .eq('user_id', user.id)
          .eq('date', today);

        if (error) throw error;

        toast({
          title: 'Checked Out!',
          description: `You checked out at ${format(new Date(), 'hh:mm a')}`,
        });

        // Auto-stop live tracking on check-out
        if (canTrack) {
          stopTrackingSilent();
          toast({
            title: '📍 Live Location Tracking Stopped',
            description: 'Your live location is no longer being shared.',
          });
        }
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

  // Production-grade camera capture handler with backend verification
  const handleCameraCapture = async (photoDataUrl: string, localFaceVerified: boolean) => {
    setShowCamera(false);
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'User not authenticated.',
        variant: 'destructive',
      });
      return;
    }

    // If face verification is enabled, use backend verification
    if (systemSettings.faceVerificationEnabled && profile?.face_embedding) {
      setIsVerifying(true);
      
      try {
        // Get fresh location
        let gpsData = location;
        if (systemSettings.gpsTrackingEnabled) {
          try {
            const freshPos = await getCurrentPosition();
            gpsData = {
              lat: freshPos.latitude,
              lng: freshPos.longitude,
              timestamp: freshPos.timestamp,
              accuracy: freshPos.accuracy,
            };
          } catch (gpsError: any) {
            throw new Error(gpsError.message || 'GPS location required');
          }
        }

        if (!gpsData && systemSettings.gpsTrackingEnabled) {
          throw new Error('GPS location required');
        }

        if (!challengeToken) {
          throw new Error('Verification session expired. Please try again.');
        }

        // Call backend verification API
        const result = await verifyAttendance({
          challengeToken: challengeToken.token,
          capturedImage: photoDataUrl,
          latitude: gpsData?.lat || 0,
          longitude: gpsData?.lng || 0,
          gpsTimestamp: gpsData?.timestamp || new Date().toISOString(),
          action: captureType,
        });

        if (!result.success) {
          throw new Error(result.error || 'Verification failed');
        }

        toast({
          title: captureType === 'check-in' ? 'Checked In!' : 'Checked Out!',
          description: `Face verified (${result.faceConfidence}% confidence)`,
        });

        // Auto-start/stop live tracking
        if (captureType === 'check-in' && canTrack) {
          startTrackingSilent();
          toast({
            title: '📍 Live Location Tracking Started',
            description: 'Your live location is now being shared with your company.',
          });
        } else if (captureType === 'check-out' && canTrack) {
          stopTrackingSilent();
          toast({
            title: '📍 Live Location Tracking Stopped',
            description: 'Your live location is no longer being shared.',
          });
        }

        fetchTodayAttendance();
        fetchMonthlyStats();
      } catch (error: any) {
        console.error('Verification error:', error);
        toast({
          title: 'Verification Failed',
          description: error.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsVerifying(false);
        setChallengeToken(null);
      }
      return;
    }

    // Fallback: Direct attendance (no face verification enabled)
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();

      // Upload photo to storage
      const photoUrl = await uploadPhotoToStorage(photoDataUrl, user.id, captureType);

      if (captureType === 'check-in') {
        const { error } = await supabase.from('attendance').insert({
          user_id: user.id,
          date: today,
          check_in_time: now,
          check_in_latitude: systemSettings.gpsTrackingEnabled ? location?.lat : null,
          check_in_longitude: systemSettings.gpsTrackingEnabled ? location?.lng : null,
          check_in_photo_url: photoUrl,
          check_in_face_verified: localFaceVerified,
          status: 'present',
          gps_timestamp: location?.timestamp || null,
        });

        if (error) throw error;

        toast({
          title: 'Checked In!',
          description: `You checked in at ${format(new Date(), 'hh:mm a')}`,
        });

        // Auto-start live tracking on check-in
        if (canTrack) {
          startTrackingSilent();
          toast({
            title: '📍 Live Location Tracking Started',
            description: 'Your live location is now being shared with your company.',
          });
        }
      } else {
        const { error } = await supabase
          .from('attendance')
          .update({
            check_out_time: now,
            check_out_latitude: systemSettings.gpsTrackingEnabled ? location?.lat : null,
            check_out_longitude: systemSettings.gpsTrackingEnabled ? location?.lng : null,
            check_out_photo_url: photoUrl,
            check_out_face_verified: localFaceVerified,
          })
          .eq('user_id', user.id)
          .eq('date', today);

        if (error) throw error;

        toast({
          title: 'Checked Out!',
          description: `You checked out at ${format(new Date(), 'hh:mm a')}`,
        });

        // Auto-stop live tracking on check-out
        if (canTrack) {
          stopTrackingSilent();
          toast({
            title: '📍 Live Location Tracking Stopped',
            description: 'Your live location is no longer being shared.',
          });
        }
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

  const uploadPhotoToStorage = async (photoDataUrl: string, userId: string, type: 'check-in' | 'check-out'): Promise<string | null> => {
    try {
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();
      
      const timestamp = Date.now();
      const date = format(new Date(), 'yyyy-MM-dd');
      const fileName = `${userId}/${date}/${type}-${timestamp}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      
      if (error) {
        console.error('Photo upload error:', error);
        return null;
      }
      
      return fileName;
    } catch (error) {
      console.error('Failed to upload photo:', error);
      return null;
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
      {/* Verification Overlay */}
      {isVerifying && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <Card className="w-full max-w-md mx-4 p-8 text-center">
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary mb-4" />
            <h3 className="font-display font-semibold text-xl mb-2">Verifying Attendance</h3>
            <p className="text-muted-foreground">Please wait while we verify your face and location...</p>
          </Card>
        </div>
      )}

      {/* Header */}
      <RoleBasedHeader currentView="employee" />

      <main className="container mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-20 sm:pb-6">
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

        {/* Location Status - only show if GPS tracking is enabled */}
        {systemSettings.gpsTrackingEnabled && locationError && (
          <Card className="border-warning/30 bg-warning-soft">
            <CardContent className="py-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              <p className="text-sm text-warning">{locationError}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-auto"
                onClick={refreshLocation}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Warning: Approaching 24-hour limit */}
        {hasCheckedIn && !hasCheckedOut && todayAttendance?.check_in_time && isApproaching24Hours(todayAttendance.check_in_time) && (
          <Card className="border-destructive/50 bg-destructive-soft">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Punch Out Soon!</p>
                <p className="text-sm text-destructive/80">
                  You have {(() => {
                    const remaining = getRemainingTime(todayAttendance.check_in_time);
                    if (!remaining) return '0 minutes';
                    return `${remaining.hours}h ${remaining.minutes}m`;
                  })()} left to check out. 
                  After 24 hours, your attendance will be marked as "Punch Missing" with no overtime.
                </p>
              </div>
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

            {systemSettings.gpsTrackingEnabled && location && location.lat !== 0 && (
              <div className="text-white/80 text-sm mb-4">
                <LocationDisplay 
                  latitude={location.lat} 
                  longitude={location.lng} 
                  showCoordinates={false}
                  className="text-white/80"
                />
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
                disabled={(systemSettings.gpsTrackingEnabled && !location) || isVerifying || isInitiatingAttendance}
              >
                {isInitiatingAttendance ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : systemSettings.photoCaptureEnabled ? (
                  <Camera className="w-5 h-5 mr-2" />
                ) : (
                  <LogIn className="w-5 h-5 mr-2" />
                )}
                {isInitiatingAttendance ? 'Preparing...' : 'Check In Now'}
              </Button>
            ) : !hasCheckedOut ? (
              <Button 
                variant="check-out" 
                size="xl" 
                className="w-full"
                onClick={handleCheckOut}
                disabled={(systemSettings.gpsTrackingEnabled && !location) || isVerifying || isInitiatingAttendance}
              >
                {isInitiatingAttendance ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : systemSettings.photoCaptureEnabled ? (
                  <Camera className="w-5 h-5 mr-2" />
                ) : (
                  <LogOut className="w-5 h-5 mr-2" />
                )}
                {isInitiatingAttendance ? 'Preparing...' : 'Check Out Now'}
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-3 py-4 text-success">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-semibold text-lg">Attendance Complete for Today</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Stats - 2x2 grid on mobile */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-success-soft flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-display font-bold">{monthlyStats.present}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Present</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-destructive-soft flex items-center justify-center shrink-0">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-display font-bold">{monthlyStats.absent}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-info-soft flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-info" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-display font-bold">{monthlyStats.leave}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Leave</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-accent-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-display font-bold">
                  {monthlyStats.total > 0 
                    ? Math.round((monthlyStats.present / monthlyStats.total) * 100) 
                    : 0}%
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Attendance</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Overtime Chart - only show if overtime tracking is enabled */}
        {systemSettings.overtimeTrackingEnabled && <OvertimeChart />}

        {/* Calendar */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Monthly Overview
                </CardTitle>
                <CardDescription>Your attendance for {format(new Date(), 'MMMM yyyy')}</CardDescription>
              </div>
              <EmployeeAttendancePDF />
            </div>
          </CardHeader>
          <CardContent>
            <AttendanceCalendar userId={user?.id} />
          </CardContent>
        </Card>

        {/* Leave Requests - only show if leave management is enabled */}
        {systemSettings.leaveManagementEnabled && (
          <LeaveRequestForm leaveRequests={leaveRequests} onRefresh={fetchLeaveRequests} />
        )}

        {/* Face Verification Setup - only show if needed */}
        {systemSettings.faceVerificationEnabled && !hasFaceEmbedding(profile?.face_embedding ?? null) && (
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
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Leave Notifications (realtime) */}
      <LeaveNotifications onLeaveUpdate={fetchLeaveRequests} />

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => {
            setShowCamera(false);
            setChallengeToken(null);
          }}
          type={captureType}
          referenceEmbedding={systemSettings.faceVerificationEnabled ? profile?.face_embedding : null}
        />
      )}

      {/* Bottom safe area for mobile nav - removed duplicate padding */}
    </div>
  );
}
