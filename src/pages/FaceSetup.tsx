import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertCircle
} from 'lucide-react';
import { extractFaceEmbedding, loadFaceModels } from '@/lib/faceRecognition';

export default function FaceSetup() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedEmbedding, setCapturedEmbedding] = useState<number[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [step, setStep] = useState<'intro' | 'capture' | 'confirm' | 'complete'>('intro');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);

  // Redirect if already has face embedding
  useEffect(() => {
    const checkExistingEmbedding = async () => {
      if (!user) return;
      
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
  }, [user, navigate]);

  // Load face models on mount
  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsLoading(false))
      .catch((err) => {
        console.error('Failed to load face models:', err);
        toast({
          title: 'Error',
          description: 'Failed to load face recognition. Please refresh the page.',
          variant: 'destructive',
        });
        setModelsLoading(false);
      });
  }, [toast]);

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

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw without mirroring for face detection
    ctx.drawImage(video, 0, 0);
    
    setIsExtracting(true);
    setFaceDetected(false);
    
    try {
      // Extract face embedding
      const embedding = await extractFaceEmbedding(canvas);
      
      if (!embedding) {
        toast({
          title: 'No Face Detected',
          description: 'Please position your face clearly in the camera.',
          variant: 'destructive',
        });
        setIsExtracting(false);
        return;
      }
      
      // Create mirrored display image
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
      setCapturedImage(dataUrl);
      setCapturedEmbedding(embedding);
      setFaceDetected(true);
      stopCamera();
      setStep('confirm');
    } catch (error) {
      console.error('Face extraction error:', error);
      toast({
        title: 'Face Detection Failed',
        description: 'Could not detect face. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setCapturedEmbedding(null);
    setFaceDetected(false);
    startCamera();
  };

  const saveFaceEmbedding = async () => {
    if (!capturedEmbedding || !user) return;

    setIsUploading(true);
    try {
      // Save embedding to profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          face_embedding: capturedEmbedding,
          face_reference_url: null // Clear old image URL if any
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setStep('complete');
      await refreshProfile();
      
      toast({
        title: 'Face Setup Complete!',
        description: 'Your face has been registered for verification.',
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save face data',
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
                  We'll capture your face features for secure attendance verification. This works completely offline on your device.
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
          {step === 'capture' && (
            <div className="space-y-4">
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
                
                {isExtracting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                    <RefreshCw className="w-10 h-10 text-white animate-spin mb-3" />
                    <p className="text-white text-sm">Detecting face...</p>
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
                        Position your face within the guide
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex justify-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    stopCamera();
                    setCameraError(null);
                    setStep('intro');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={capturePhoto} 
                  variant="hero" 
                  disabled={!showCamera || cameraLoading || !!cameraError || isExtracting}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {isExtracting ? 'Processing...' : 'Capture Photo'}
                </Button>
              </div>
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && capturedImage && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-display font-semibold text-lg">Review Your Photo</h2>
                <p className="text-sm text-muted-foreground">
                  {faceDetected ? 'Face detected successfully!' : 'Make sure your face is clearly visible'}
                </p>
              </div>
              
              <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  className="w-full h-full object-cover"
                />
                {faceDetected && (
                  <div className="absolute top-4 right-4">
                    <div className="bg-success/90 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span className="text-white text-sm font-medium">Face Detected</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={retakePhoto}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button onClick={saveFaceEmbedding} disabled={isUploading || !faceDetected} variant="success">
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
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
                  Your face has been registered successfully. Face verification now works offline on your device.
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
