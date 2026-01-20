import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Camera, X, Loader2, ShieldCheck, ShieldX, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { extractFaceEmbedding, compareFaceEmbeddings, loadFaceModels } from '@/lib/faceRecognition';
import * as faceapi from 'face-api.js';

interface CameraCaptureProps {
  onCapture: (photoDataUrl: string, faceVerified: boolean) => void;
  onClose: () => void;
  type: 'check-in' | 'check-out';
  referenceEmbedding?: number[] | null;
}

// Helper to validate and normalize embedding
function normalizeEmbedding(embedding: unknown): number[] | null {
  if (!embedding) return null;
  
  if (Array.isArray(embedding) && embedding.length === 128) {
    const allNumbers = embedding.every(v => typeof v === 'number' && !isNaN(v));
    return allNumbers ? embedding : null;
  }
  
  if (typeof embedding === 'object' && embedding !== null) {
    const arr: number[] = [];
    for (let i = 0; i < 128; i++) {
      const val = (embedding as Record<string, unknown>)[String(i)];
      if (typeof val !== 'number' || isNaN(val)) return null;
      arr.push(val);
    }
    return arr.length === 128 ? arr : null;
  }
  
  return null;
}

const FACE_HOLD_FRAMES = 6; // Hold face steady for 6 frames
const DETECTION_INTERVAL = 150; // Check every 150ms

export default function CameraCapture({ onCapture, onClose, type, referenceEmbedding }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const captureTriggeredRef = useRef(false);
  const faceFrameCountRef = useRef(0);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(60);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Preparing camera...');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    match: boolean;
    confidence: number;
  } | null>(null);

  const validReferenceEmbedding = useMemo(() => normalizeEmbedding(referenceEmbedding), [referenceEmbedding]);
  const requiresFaceVerification = validReferenceEmbedding !== null;

  // Load face models
  useEffect(() => {
    loadFaceModels()
      .then(() => {
        setModelsLoading(false);
        setStatusMessage('Position your face in the frame');
      })
      .catch((err) => {
        console.error('Failed to load face models:', err);
        setError('Failed to load face recognition. Please refresh.');
        setModelsLoading(false);
      });
  }, []);

  // Fetch threshold setting
  useEffect(() => {
    supabase.from('system_settings')
      .select('value')
      .eq('key', 'face_verification_threshold')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const threshold = (data.value as { threshold?: number })?.threshold ?? 60;
          setConfidenceThreshold(threshold);
        }
      });
  }, []);

  // Start camera when models are ready
  useEffect(() => {
    if (!modelsLoading) {
      startCamera();
    }
    return () => {
      stopCamera();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [modelsLoading]);

  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsLoading(false);
          // Start face detection loop
          startFaceDetection();
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please grant permission.');
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Simple face detection loop - auto captures when face is stable
  const startFaceDetection = useCallback(() => {
    const detect = async () => {
      if (!videoRef.current || captureTriggeredRef.current) return;

      try {
        // Simple face detection
        const detection = await faceapi.detectSingleFace(
          videoRef.current, 
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
        );

        if (detection) {
          faceFrameCountRef.current++;
          const progress = Math.min((faceFrameCountRef.current / FACE_HOLD_FRAMES) * 100, 100);
          setDetectionProgress(progress);
          setStatusMessage(`Hold steady... ${Math.round(progress)}%`);

          // Auto capture when held for enough frames
          if (faceFrameCountRef.current >= FACE_HOLD_FRAMES && !captureTriggeredRef.current) {
            captureTriggeredRef.current = true;
            setStatusMessage('Capturing...');
            await captureAndVerify();
            return;
          }
        } else {
          // Reset if face lost
          faceFrameCountRef.current = Math.max(0, faceFrameCountRef.current - 2);
          setDetectionProgress(Math.max(0, (faceFrameCountRef.current / FACE_HOLD_FRAMES) * 100));
          setStatusMessage('Position your face in the frame');
        }

        // Continue detection
        animationFrameRef.current = requestAnimationFrame(() => {
          setTimeout(detect, DETECTION_INTERVAL);
        });
      } catch (err) {
        console.error('Detection error:', err);
        animationFrameRef.current = requestAnimationFrame(() => {
          setTimeout(detect, DETECTION_INTERVAL * 2);
        });
      }
    };

    detect();
  }, []);

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Create mirrored version for display
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = canvas.width;
    displayCanvas.height = canvas.height;
    const displayContext = displayCanvas.getContext('2d');
    if (displayContext) {
      displayContext.translate(canvas.width, 0);
      displayContext.scale(-1, 1);
      displayContext.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    
    const dataUrl = displayCanvas.toDataURL('image/jpeg', 0.8);
    stopCamera();
    
    // Cancel detection loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Verify face if reference exists
    if (requiresFaceVerification && validReferenceEmbedding) {
      setIsVerifying(true);
      setStatusMessage('Verifying face...');
      
      try {
        const capturedEmbedding = await extractFaceEmbedding(canvas);
        
        if (!capturedEmbedding) {
          setVerificationResult({ match: false, confidence: 0 });
          setVerificationComplete(true);
          setIsVerifying(false);
          setStatusMessage('No face detected');
          // Auto close after delay
          setTimeout(() => onCapture(dataUrl, false), 1500);
          return;
        }

        const similarityThreshold = confidenceThreshold / 100;
        const result = compareFaceEmbeddings(validReferenceEmbedding, capturedEmbedding, similarityThreshold);
        
        setVerificationResult({ match: result.match, confidence: result.confidence });
        setVerificationComplete(true);
        setIsVerifying(false);
        setStatusMessage(result.match ? 'Face verified!' : 'Face not matched');
        
        // Auto-confirm after short delay
        setTimeout(() => {
          onCapture(dataUrl, result.match);
        }, result.match ? 800 : 1500);
        
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationResult({ match: false, confidence: 0 });
        setVerificationComplete(true);
        setIsVerifying(false);
        setStatusMessage('Verification failed');
        setTimeout(() => onCapture(dataUrl, false), 1500);
      }
    } else {
      // No verification needed, just capture
      setStatusMessage('Photo captured!');
      setVerificationComplete(true);
      setTimeout(() => onCapture(dataUrl, true), 500);
    }
  };

  if (modelsLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
          <h3 className="font-display font-semibold text-lg mb-2">Loading Face Recognition</h3>
          <p className="text-sm text-muted-foreground">Preparing face detection...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="gradient-primary p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            <h3 className="font-display font-semibold">
              {type === 'check-in' ? 'Check In Photo' : 'Check Out Photo'}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Camera View */}
        <div className="relative aspect-[4/3] bg-black">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
              <div>
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{error}</p>
              </div>
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

          {/* Face Guide Overlay */}
          {!error && !verificationComplete && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-48 h-60 border-2 border-dashed rounded-full transition-colors ${
                detectionProgress >= 100 ? 'border-success' : 'border-white/50'
              }`} />
            </div>
          )}

          {/* Status Overlay */}
          {!error && (
            <div className="absolute top-4 left-4 right-4">
              <div className={`backdrop-blur rounded-lg p-3 ${
                verificationComplete 
                  ? verificationResult?.match ? 'bg-success/90' : 'bg-destructive/90'
                  : 'bg-black/70'
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  {verificationComplete ? (
                    verificationResult?.match ? (
                      <ShieldCheck className="w-5 h-5 text-white" />
                    ) : (
                      <ShieldX className="w-5 h-5 text-white" />
                    )
                  ) : isVerifying ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                  <span className="text-white text-sm font-medium flex-1">
                    {statusMessage}
                  </span>
                  {verificationComplete && verificationResult && (
                    <span className="text-white/80 text-xs">
                      {verificationResult.confidence}%
                    </span>
                  )}
                </div>
                {!verificationComplete && (
                  <Progress value={isVerifying ? 100 : detectionProgress} className="h-1.5" />
                )}
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Simple footer */}
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {verificationComplete 
              ? (verificationResult?.match ? 'Attendance recorded!' : 'Please try again')
              : 'Look at the camera - auto capture in progress'
            }
          </p>
        </div>
      </Card>
    </div>
  );
}
