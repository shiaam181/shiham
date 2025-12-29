import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, 
  Upload,
  RefreshCw,
  CheckCircle2,
  Shield,
  Scan,
  ArrowRight
} from 'lucide-react';

export default function FaceSetup() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<'intro' | 'capture' | 'confirm' | 'complete'>('intro');

  // Redirect if already has face reference
  useEffect(() => {
    if (profile?.face_reference_url) {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setShowCamera(true);
      setStep('capture');
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
    
    // Mirror the image
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
    setStep('confirm');
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
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

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      // Update profile with face reference URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ face_reference_url: urlData.publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setStep('complete');
      await refreshProfile();
      
      toast({
        title: 'Face Setup Complete!',
        description: 'Your face has been registered for verification.',
      });

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
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

  const getProgress = () => {
    switch (step) {
      case 'intro': return 25;
      case 'capture': return 50;
      case 'confirm': return 75;
      case 'complete': return 100;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-2xl border-0 overflow-hidden">
        {/* Header */}
        <div className="gradient-primary p-6 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="font-display font-bold text-2xl mb-2">Face Verification Setup</h1>
          <p className="text-white/80 text-sm">One-time setup to secure your attendance</p>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 bg-muted/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step === 'intro' ? 1 : step === 'capture' ? 2 : step === 'confirm' ? 3 : 4} of 4</span>
            <span>{getProgress()}% complete</span>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </div>

        <CardContent className="p-6">
          {/* Intro Step */}
          {step === 'intro' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Scan className="w-12 h-12 text-primary" />
              </div>
              
              <div>
                <h2 className="font-display font-semibold text-xl mb-2">Welcome, {profile?.full_name?.split(' ')[0]}!</h2>
                <p className="text-muted-foreground">
                  To ensure secure attendance tracking, we need to capture your face for verification.
                  This photo will be used to verify your identity during check-in and check-out.
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 text-left space-y-3">
                <h3 className="font-semibold text-sm">Tips for best results:</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    Find a well-lit area with even lighting
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    Look directly at the camera
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    Remove glasses or hats if possible
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    Keep a neutral expression
                  </li>
                </ul>
              </div>

              <Button onClick={startCamera} size="lg" className="w-full" variant="hero">
                <Camera className="w-5 h-5 mr-2" />
                Start Face Capture
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Camera Step */}
          {step === 'capture' && showCamera && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Face guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-60 border-4 border-dashed border-white/50 rounded-full" />
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-center">
                  <p className="text-white text-sm bg-black/50 backdrop-blur rounded-lg px-4 py-2">
                    Position your face within the guide
                  </p>
                </div>
              </div>
              
              <div className="flex justify-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    stopCamera();
                    setStep('intro');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={capturePhoto} variant="hero">
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Photo
                </Button>
              </div>
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && capturedImage && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-display font-semibold text-lg">Review Your Photo</h2>
                <p className="text-sm text-muted-foreground">Make sure your face is clearly visible</p>
              </div>
              
              <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={retakePhoto}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button onClick={uploadFaceReference} disabled={isUploading} variant="success">
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Confirm & Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="text-center space-y-6 py-8">
              <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto animate-bounce-soft">
                <CheckCircle2 className="w-12 h-12 text-success" />
              </div>
              
              <div>
                <h2 className="font-display font-bold text-2xl text-success mb-2">All Set!</h2>
                <p className="text-muted-foreground">
                  Your face has been registered successfully. You can now mark your attendance with face verification.
                </p>
              </div>

              <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>
    </div>
  );
}
