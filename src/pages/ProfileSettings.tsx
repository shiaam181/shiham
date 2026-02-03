import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { hasFaceEmbedding } from '@/lib/faceEmbedding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PhoneVerificationDialog } from '@/components/PhoneVerificationDialog';
import { LiveTrackingConsent } from '@/components/LiveTrackingConsent';
import { 
  ArrowLeft, 
  User, 
  Camera, 
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Shield,
  LogOut,
  Download,
  Smartphone
} from 'lucide-react';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePWAInstall } from '@/hooks/usePWAInstall';

// Install App Card Component
function InstallAppCard() {
  const navigate = useNavigate();
  const { isInstalled, isInstallable, promptInstall, showIOSInstructions } = usePWAInstall();
  
  if (isInstalled) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <CheckCircle2 className="w-5 h-5" />
            App Installed
          </CardTitle>
          <CardDescription>AttendanceHub is installed on your device</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleInstall = async () => {
    if (isInstallable) {
      await promptInstall();
    } else {
      navigate('/install');
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          Install App
        </CardTitle>
        <CardDescription>
          {showIOSInstructions 
            ? 'Add to your home screen for the best experience'
            : 'Install AttendanceHub for offline access and notifications'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleInstall}
          className="w-full"
          variant="outline"
        >
          <Download className="w-4 h-4 mr-2" />
          {showIOSInstructions ? 'View Install Instructions' : 'Install App'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [faceImageUrl, setFaceImageUrl] = useState<string | null>(null);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });

  // Load signed URL for face preview image from storage
  useEffect(() => {
    const loadFaceImage = async () => {
      if (profile?.face_reference_url && user) {
        try {
          // face_reference_url now stores the storage path
          const { data, error } = await supabase.storage
            .from('employee-photos')
            .createSignedUrl(profile.face_reference_url, 3600); // 1 hour expiry
          
          if (data && !error) {
            setFaceImageUrl(data.signedUrl);
          } else {
            setFaceImageUrl(null);
          }
        } catch (err) {
          console.error('Error loading face image:', err);
          setFaceImageUrl(null);
        }
      } else {
        setFaceImageUrl(null);
      }
    };
    
    loadFaceImage();
  }, [profile?.face_reference_url, user]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      
      streamRef.current = stream;
      setShowCamera(true);
      
      // Wait for next render then attach stream to video
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const uploadFaceReference = async () => {
    if (!capturedImage || !user) return;

    setIsUploading(true);
    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const fileName = `${user.id}/face-reference.jpg`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, blob, {
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      // Update profile with face reference path (not public URL - bucket is now private)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ face_reference_url: fileName })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Face reference photo saved successfully',
      });

      setCapturedImage(null);
      refreshProfile();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload photo',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const existingPhone = profile?.phone || '';
    const newPhone = formData.phone.trim();
    const isPhoneChanged = existingPhone !== newPhone;
    const isAddingNewPhone = !existingPhone && newPhone;

    // If phone is being CHANGED (not added for first time), require verification
    if (isPhoneChanged && !isAddingNewPhone && newPhone) {
      setPendingPhone(newPhone);
      setShowPhoneVerification(true);
      return;
    }

    await saveProfile(formData.full_name, formData.phone);
  };

  const saveProfile = async (fullName: string, phone: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
      refreshProfile();
    } catch (error: any) {
      console.error('Update error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    }
  };

  const handlePhoneVerified = async () => {
    // After OTP verification, save the profile with the new phone
    await saveProfile(formData.full_name, pendingPhone);
    setPendingPhone('');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">Profile Settings</h1>
                <p className="text-xs text-muted-foreground">Manage your profile and face verification</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Face Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Face Verification
            </CardTitle>
            <CardDescription>
              For privacy and accuracy, we store only your face features (embedding) — not a saved face photo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Reference Photo */}
            <div className="flex items-start gap-4">
              <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                {faceImageUrl ? (
                  <img 
                    src={faceImageUrl} 
                    alt="Face reference" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {hasFaceEmbedding(profile?.face_embedding ?? null) ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <span className="font-medium text-success">Face Registered</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-warning" />
                      <span className="font-medium text-warning">No Face Registered</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {hasFaceEmbedding(profile?.face_embedding ?? null)
                    ? 'Your face is registered for verification. You can update it anytime.'
                    : 'Please capture a clear photo of your face for verification during attendance.'}
                </p>
                <Button onClick={() => navigate('/face-setup?update=true')} variant="outline" size="sm">
                  <Camera className="w-4 h-4 mr-2" />
                    {hasFaceEmbedding(profile?.face_embedding ?? null) ? 'Update Face' : 'Setup Face'}
                </Button>
              </div>
            </div>

            {/* Camera View */}
            {showCamera && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-4 border-primary/50 rounded-xl pointer-events-none" />
                </div>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                  <Button onClick={capturePhoto}>
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                </div>
              </div>
            )}

            {/* Captured Image Preview */}
            {capturedImage && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
                  <img 
                    src={capturedImage} 
                    alt="Captured" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={() => setCapturedImage(null)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retake
                  </Button>
                  <Button onClick={uploadFaceReference} disabled={isUploading}>
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Save Photo
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Your phone number"
                />
                {profile?.phone && formData.phone !== profile.phone && formData.phone.trim() && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Phone change requires OTP verification
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={profile?.department || 'Not assigned'}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Input
                    value={profile?.position || 'Not assigned'}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full">
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Location Tracking Consent */}
        <LiveTrackingConsent />

        {/* Install App */}
        <InstallAppCard />

        {/* Account Actions */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <LogOut className="w-5 h-5" />
              Account Actions
            </CardTitle>
            <CardDescription>Sign out of your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              className="w-full" 
              onClick={async () => {
                await signOut();
                navigate('/auth');
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
        
        {/* Add padding for bottom nav on mobile */}
        {isMobile && <div className="h-20" />}
      </main>

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileBottomNav />}

      {/* Phone Verification Dialog */}
      <PhoneVerificationDialog
        open={showPhoneVerification}
        onOpenChange={setShowPhoneVerification}
        newPhone={pendingPhone}
        onVerified={handlePhoneVerified}
      />
    </div>
  );
}
