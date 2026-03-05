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
  RotateCcw,
  MoveRight,
  MoveLeft,
  MoveUp,
  MoveDown,
  Circle
} from 'lucide-react';
import { registerFace } from '@/lib/faceVerificationService';
import { loadFaceModels } from '@/lib/faceRecognition';
import * as faceapi from 'face-api.js';

const REQUIRED_POSES = [
  { id: 'center', label: 'Look straight ahead', icon: Circle, instruction: 'Keep your face centered' },
  { id: 'right', label: 'Turn head right', icon: MoveRight, instruction: 'Slowly turn your head to the right' },
  { id: 'left', label: 'Turn head left', icon: MoveLeft, instruction: 'Slowly turn your head to the left' },
];

const FACE_STABLE_FRAMES = 6;
const DETECTION_INTERVAL = 100;

export default function FaceSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isUpdate = searchParams.get('update') === 'true';
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableFramesRef = useRef(0);
  const capturedRef = useRef(false);
  
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<'intro' | 'capture' | 'confirm' | 'complete'>('intro');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [poseProgress, setPoseProgress] = useState(0);
  const [poseStatus, setPoseStatus] = useState<'waiting' | 'detecting' | 'captured'>('waiting');
  const [showFlash, setShowFlash] = useState(false);

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

  // Load face models on mount
  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsLoading(false))
      .catch((err) => {
        console.error('Failed to load face models:', err);
        setModelsLoading(false);
      });
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setCameraLoading(true);
    setStep('capture');
    setCurrentPoseIndex(0);
    setCapturedImages([]);
    setPoseStatus('waiting');
    stableFramesRef.current = 0;
    capturedRef.current = false;
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
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
      setCameraLoading(false);
      startDetectionLoop();
    } catch (error: any) {
      console.error('Camera error:', error);
      setCameraLoading(false);
      
      let errorMessage = 'Could not access camera. Please check permissions.';
      if (error.name === 'NotReadableError') errorMessage = 'Camera is in use by another app.';
      else if (error.name === 'NotAllowedError') errorMessage = 'Camera access denied. Please allow camera permissions.';
      else if (error.name === 'NotFoundError') errorMessage = 'No camera found.';
      
      setCameraError(errorMessage);
      toast({ title: 'Camera Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const stopCamera = useCallback(() => {
    if (detectionRef.current) {
      clearTimeout(detectionRef.current);
      detectionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const autoCapturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || capturedRef.current) return null;
    capturedRef.current = true;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return rawDataUrl;
  }, []);

  const startDetectionLoop = useCallback(() => {
    const detect = async () => {
      if (!videoRef.current || capturedRef.current) return;

      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks();

        if (detection) {
          const landmarks = detection.landmarks;
          const nose = landmarks.getNose();
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          
          // Calculate head pose from landmarks
          const noseTip = nose[3]; // tip of nose
          const leftEyeCenter = { x: leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length, y: leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length };
          const rightEyeCenter = { x: rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length, y: rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length };
          const eyeCenter = { x: (leftEyeCenter.x + rightEyeCenter.x) / 2, y: (leftEyeCenter.y + rightEyeCenter.y) / 2 };
          
          // Horizontal offset: nose tip relative to eye center (normalized by eye distance)
          const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
          const horizontalOffset = (noseTip.x - eyeCenter.x) / eyeDistance;
          
          const currentPose = REQUIRED_POSES[stableFramesRef.current >= FACE_STABLE_FRAMES ? 0 : currentPoseIndex];
          let poseMatched = false;

          // Use the currentPoseIndex from state - read it via closure
          const poseId = REQUIRED_POSES[currentPoseIndex]?.id;
          
          if (poseId === 'center') {
            poseMatched = Math.abs(horizontalOffset) < 0.15;
          } else if (poseId === 'right') {
            // On mirrored camera, turning head right = nose moves left relative to eyes
            poseMatched = horizontalOffset < -0.12;
          } else if (poseId === 'left') {
            poseMatched = horizontalOffset > 0.12;
          }

          if (poseMatched) {
            stableFramesRef.current++;
            setPoseProgress((stableFramesRef.current / FACE_STABLE_FRAMES) * 100);
            setPoseStatus('detecting');

            if (stableFramesRef.current >= FACE_STABLE_FRAMES) {
              // Capture!
              const img = autoCapturePhoto();
              if (img) {
                // Flash effect
                setShowFlash(true);
                setTimeout(() => setShowFlash(false), 200);
                
                setCapturedImages(prev => {
                  const newImages = [...prev, img];
                  
                  if (newImages.length >= REQUIRED_POSES.length) {
                    // All poses captured, go to confirm
                    setTimeout(() => {
                      stopCamera();
                      setStep('confirm');
                    }, 500);
                  } else {
                    // Move to next pose
                    setCurrentPoseIndex(prev => prev + 1);
                    stableFramesRef.current = 0;
                    capturedRef.current = false;
                    setPoseProgress(0);
                    setPoseStatus('waiting');
                  }
                  
                  return newImages;
                });
                
                setPoseStatus('captured');
                return; // Stop detection loop briefly
              }
            }
          } else {
            stableFramesRef.current = Math.max(0, stableFramesRef.current - 1);
            setPoseProgress((stableFramesRef.current / FACE_STABLE_FRAMES) * 100);
            setPoseStatus('waiting');
          }
        } else {
          stableFramesRef.current = 0;
          setPoseProgress(0);
          setPoseStatus('waiting');
        }
      } catch (err) {
        console.error('Detection error:', err);
      }

      detectionRef.current = setTimeout(detect, DETECTION_INTERVAL);
    };

    detect();
  }, [currentPoseIndex, autoCapturePhoto, stopCamera]);

  // Restart detection when pose index changes
  useEffect(() => {
    if (step === 'capture' && !cameraLoading && !cameraError && currentPoseIndex > 0) {
      // Small delay before starting next pose detection
      const timer = setTimeout(() => {
        capturedRef.current = false;
        stableFramesRef.current = 0;
        startDetectionLoop();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentPoseIndex, step, cameraLoading, cameraError]);

  // Cleanup
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const saveFaceRegistration = async () => {
    if (capturedImages.length < REQUIRED_POSES.length || !user) return;

    setIsUploading(true);
    try {
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

      setTimeout(() => navigate('/install'), 2000);
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
      case 'capture': return 25 + (capturedImages.length / REQUIRED_POSES.length) * 50;
      case 'confirm': return 80;
      case 'complete': return 100;
      default: return 0;
    }
  };

  const currentPose = REQUIRED_POSES[currentPoseIndex];
  const PoseIcon = currentPose?.icon || Circle;

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
            <span>{Math.round(getProgress())}% complete</span>
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
                  We'll automatically capture your face from different angles — just like setting up face unlock on your phone.
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 text-left space-y-3">
                <h3 className="font-semibold text-sm">How it works:</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <Circle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    Look straight at the camera
                  </li>
                  <li className="flex items-start gap-2">
                    <MoveRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    Turn your head to the right
                  </li>
                  <li className="flex items-start gap-2">
                    <MoveLeft className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    Turn your head to the left
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Photos are captured automatically when you match the pose — no buttons needed!
                </p>
              </div>

              <Button onClick={startCamera} size="lg" className="w-full" variant="hero">
                <Camera className="w-5 h-5 mr-2" />
                Start Face Capture
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Camera Step - Auto capture with pose guidance */}
          {step === 'capture' && (
            <div className="space-y-4">
              {/* Pose indicators */}
              <div className="flex justify-center gap-3 mb-2">
                {REQUIRED_POSES.map((pose, idx) => (
                  <div
                    key={pose.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      idx < capturedImages.length
                        ? 'bg-success/20 text-success'
                        : idx === currentPoseIndex
                        ? 'bg-primary/20 text-primary ring-2 ring-primary/30'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {idx < capturedImages.length ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <pose.icon className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">{pose.id}</span>
                  </div>
                ))}
              </div>

              {/* Current pose instruction */}
              {currentPose && (
                <div className="text-center">
                  <h2 className="font-display font-semibold text-lg flex items-center justify-center gap-2">
                    <PoseIcon className="w-5 h-5 text-primary" />
                    {currentPose.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">{currentPose.instruction}</p>
                </div>
              )}

              <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '3/4' }}>
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

                {/* Flash effect on capture */}
                {showFlash && (
                  <div className="absolute inset-0 bg-white z-30 animate-pulse" />
                )}
                
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)', objectPosition: 'center center' }}
                />
                
                {!cameraError && !cameraLoading && (
                  <>
                    {/* Face guide oval */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-48 h-60 border-4 border-dashed rounded-full transition-colors duration-300 ${
                        poseStatus === 'captured' ? 'border-success' :
                        poseStatus === 'detecting' ? 'border-primary' :
                        'border-white/40'
                      }`} />
                    </div>

                    {/* Pose direction arrow indicator */}
                    {currentPose && poseStatus !== 'captured' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {currentPose.id === 'right' && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-pulse">
                            <MoveRight className="w-10 h-10 text-primary drop-shadow-lg" />
                          </div>
                        )}
                        {currentPose.id === 'left' && (
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 animate-pulse">
                            <MoveLeft className="w-10 h-10 text-primary drop-shadow-lg" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Progress ring at bottom */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-black/60 backdrop-blur rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          {poseStatus === 'captured' ? (
                            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                          ) : poseStatus === 'detecting' ? (
                            <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                          ) : (
                            <PoseIcon className="w-5 h-5 text-white/70 shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">
                              {poseStatus === 'captured' 
                                ? 'Captured!' 
                                : poseStatus === 'detecting'
                                ? `Hold steady... ${Math.round(poseProgress)}%`
                                : currentPose?.instruction || 'Position your face'
                              }
                            </p>
                            <div className="w-full h-1.5 bg-white/20 rounded-full mt-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-150 ${
                                  poseStatus === 'captured' ? 'bg-success' : 'bg-primary'
                                }`}
                                style={{ width: `${poseStatus === 'captured' ? 100 : poseProgress}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-white/60 text-xs">
                            {capturedImages.length}/{REQUIRED_POSES.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    stopCamera();
                    setCameraError(null);
                    setCapturedImages([]);
                    setCurrentPoseIndex(0);
                    setStep('intro');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && capturedImages.length >= REQUIRED_POSES.length && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-display font-semibold text-lg">Review Your Photos</h2>
                <p className="text-sm text-muted-foreground">
                  {capturedImages.length} photos captured from different angles
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
                    <div className="absolute top-2 left-2">
                      <div className="bg-black/60 backdrop-blur rounded-full px-2 py-0.5">
                        <span className="text-white text-xs font-medium">{REQUIRED_POSES[index]?.id}</span>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2">
                      <div className="bg-success/90 backdrop-blur rounded-full p-1">
                        <CheckCircle2 className="w-3 h-3 text-white" />
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
                <Button variant="outline" onClick={() => startCamera()}>
                  <RotateCcw className="w-4 h-4 mr-2" />
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
