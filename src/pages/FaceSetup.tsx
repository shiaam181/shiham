import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, 
  RefreshCw,
  CheckCircle2,
  Shield,
  Scan,
  ArrowRight,
  AlertCircle,
  Loader2,
  X,
  Plus
} from 'lucide-react';
import { registerFace } from '@/lib/faceVerificationService';
import { loadFaceModels } from '@/lib/faceRecognition';

const MIN_IMAGES = 3;
const MAX_IMAGES = 5;

export default function FaceSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isUpdate = searchParams.get('update') === 'true';
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<'intro' | 'capture' | 'confirm' | 'complete'>('intro');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);

  // Only redirect if already has face embedding AND not updating
  useEffect(() => {
    const checkExistingEmbedding = async () => {
      if (!user || isUpdate) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('face_embedding')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.face_embedding) {
        navigate('/dashboard');
      }
    };
    
    checkExistingEmbedding();
  }, [user, navigate, isUpdate]);

  // Load face models on mount (for local face detection during capture)
  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsLoading(false))
      .catch((err) => {
        console.error('Failed to load face models:', err);
        // Continue anyway - backend will handle validation
        setModelsLoading(false);
      });
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setCameraLoading(true);
    setStep('capture');
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        await new Promise<void>((resolve, reject) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve();
            videoRef.current.onerror = () => reject(new Error('Video failed to load'));
            setTimeout(() => reject(new Error('Camera timeout')), 5000);
          }
        });
      }
      setShowCamera(true);
      setCameraLoading(false);
    } catch (error: any) {
      console.error('Camera error:', error);
      setCameraLoading(false);
      
      let errorMessage = 'Could not access camera. Please check permissions.';
      if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another app.';
      } else if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera permissions.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found.';
      }
      
      setCameraError(errorMessage);
      toast({
        title: 'Camera Error',
        description: errorMessage,
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

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (capturedImages.length >= MAX_IMAGES) {
      toast({
        title: 'Maximum Photos Reached',
        description: `You can only capture up to ${MAX_IMAGES} photos.`,
        variant: 'destructive',
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    setIsCapturing(true);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the image (not mirrored - backend needs proper orientation)
    ctx.drawImage(video, 0, 0);
    
    // Create display image (mirrored for user preview)
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = canvas.width;
    displayCanvas.height = canvas.height;
    const displayCtx = displayCanvas.getContext('2d');
    if (displayCtx) {
      displayCtx.translate(canvas.width, 0);
      displayCtx.scale(-1, 1);
      displayCtx.drawImage(video, 0, 0);
    }
    
    const dataUrl = displayCanvas.toDataURL('image/jpeg', 0.8);
    // Store the non-mirrored image for backend processing
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    setCapturedImages(prev => [...prev, rawDataUrl]);
    
    toast({
      title: `Photo ${capturedImages.length + 1} Captured`,
      description: `${MIN_IMAGES - capturedImages.length - 1} more ${MIN_IMAGES - capturedImages.length - 1 === 1 ? 'photo' : 'photos'} needed`,
    });
    
    setIsCapturing(false);
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const retakePhotos = () => {
    setCapturedImages([]);
    startCamera();
  };

  const proceedToConfirm = () => {
    if (capturedImages.length < MIN_IMAGES) {
      toast({
        title: 'More Photos Needed',
        description: `Please capture at least ${MIN_IMAGES} photos.`,
        variant: 'destructive',
      });
      return;
    }
    stopCamera();
    setStep('confirm');
  };

  const saveFaceRegistration = async () => {
    if (capturedImages.length < MIN_IMAGES || !user) return;

    setIsUploading(true);
    try {
      // Call the backend registration API
      const result = await registerFace(capturedImages);
      
      if (!result.success) {
        throw new Error(result.error || 'Face registration failed');
      }

      setStep('complete');
      await refreshProfile();
      
      toast({
        title: 'Face Setup Complete!',
        description: `${result.imagesStored} face images registered for verification.`,
      });

      setTimeout(() => {
        navigate('/install');
      }, 2000);
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Registration Failed',
        description: error.message || 'Failed to register face data. Please try again.',
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

  if (modelsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg p-8 text-center">
          <RefreshCw className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
          <h3 className="font-display font-semibold text-lg mb-2">Loading Face Recognition</h3>
          <p className="text-sm text-muted-foreground">Preparing face detection models...</p>
        </Card>
      </div>
    );
  }

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
                  We'll capture {MIN_IMAGES}-{MAX_IMAGES} photos of your face for secure attendance verification.
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
                    Capture from slightly different angles
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

              <div className="bg-info-soft rounded-xl p-4 text-left">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-info shrink-0 mt-0.5" />
                  <p className="text-sm text-info">
                    You'll need to capture {MIN_IMAGES}-{MAX_IMAGES} photos to ensure accurate verification.
                  </p>
                </div>
              </div>

              <Button onClick={startCamera} size="lg" className="w-full" variant="hero">
                <Camera className="w-5 h-5 mr-2" />
                Start Face Capture
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Camera Step - Multi-image capture */}
          {step === 'capture' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-display font-semibold text-lg">Capture Your Face</h2>
                <p className="text-sm text-muted-foreground">
                  {capturedImages.length} of {MIN_IMAGES} photos captured
                  {capturedImages.length >= MIN_IMAGES && capturedImages.length < MAX_IMAGES && 
                    ` (${MAX_IMAGES - capturedImages.length} more optional)`
                  }
                </p>
              </div>

              {/* Captured Images Preview */}
              {capturedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {capturedImages.map((img, index) => (
                    <div key={index} className="relative shrink-0">
                      <img 
                        src={img} 
                        alt={`Captured ${index + 1}`} 
                        className="w-16 h-16 rounded-lg object-cover border-2 border-primary"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center rounded-b-lg">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                  {capturedImages.length < MAX_IMAGES && (
                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0">
                      <Plus className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              )}

              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                {cameraLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                    <RefreshCw className="w-10 h-10 text-white animate-spin mb-3" />
                    <p className="text-white text-sm">Starting camera...</p>
                  </div>
                )}
                
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 p-6">
                    <Camera className="w-12 h-12 text-destructive mb-3" />
                    <p className="text-white text-sm text-center mb-4">{cameraError}</p>
                    <Button onClick={startCamera} variant="outline" size="sm">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                )}
                
                {isCapturing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                    <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
                    <p className="text-white text-sm">Capturing...</p>
                  </div>
                )}
                
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                
                {showCamera && !cameraError && !cameraLoading && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-60 border-4 border-dashed border-white/50 rounded-full" />
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 text-center">
                      <p className="text-white text-sm bg-black/50 backdrop-blur rounded-lg px-4 py-2">
                        Position your face and capture {MIN_IMAGES - capturedImages.length > 0 ? MIN_IMAGES - capturedImages.length : 'more'} photo{MIN_IMAGES - capturedImages.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex flex-wrap justify-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    stopCamera();
                    setCameraError(null);
                    setCapturedImages([]);
                    setStep('intro');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={capturePhoto} 
                  variant="hero" 
                  disabled={!showCamera || cameraLoading || !!cameraError || isCapturing || capturedImages.length >= MAX_IMAGES}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {isCapturing ? 'Capturing...' : `Capture Photo ${capturedImages.length + 1}`}
                </Button>
                {capturedImages.length >= MIN_IMAGES && (
                  <Button 
                    onClick={proceedToConfirm} 
                    variant="success"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Continue
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && capturedImages.length >= MIN_IMAGES && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-display font-semibold text-lg">Review Your Photos</h2>
                <p className="text-sm text-muted-foreground">
                  {capturedImages.length} photos captured successfully
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {capturedImages.map((img, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                    <img 
                      src={img} 
                      alt={`Photo ${index + 1}`} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <div className="bg-success/90 backdrop-blur rounded-full px-2 py-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                        <span className="text-white text-xs font-medium">{index + 1}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-info-soft rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-info shrink-0 mt-0.5" />
                  <p className="text-sm text-info">
                    These photos will be securely stored and used to verify your identity during attendance.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={retakePhotos}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button onClick={saveFaceRegistration} disabled={isUploading} variant="success">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
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
                  Your face has been registered successfully. Let's set up the app on your device.
                </p>
              </div>

              <p className="text-sm text-muted-foreground">Redirecting to app install...</p>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>
    </div>
  );
}
