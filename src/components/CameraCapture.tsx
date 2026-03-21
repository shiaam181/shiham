import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Camera, X, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { extractFaceEmbedding, compareFaceEmbeddings, loadFaceModels } from '@/lib/faceRecognition';
import * as faceapi from 'face-api.js';

interface CameraCaptureProps {
  onCapture: (photoDataUrl: string, faceVerified: boolean) => void;
  onClose: () => void;
  type: 'check-in' | 'check-out';
  /**
   * May be a numeric vector (legacy/local verification) or provider metadata (backend verification).
   * We normalize internally, so keep this flexible.
   */
  referenceEmbedding?: unknown;
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

const FACE_HOLD_FRAMES = 3; // Require 3 stable frames to avoid premature capture
const DETECTION_INTERVAL = 100; // Detection interval ms

export default function CameraCapture({ onCapture, onClose, type, referenceEmbedding }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const captureTriggeredRef = useRef(false);
  const faceFrameCountRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(60);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    match: boolean;
    confidence: number;
  } | null>(null);

  const validReferenceEmbedding = useMemo(() => normalizeEmbedding(referenceEmbedding), [referenceEmbedding]);
  const requiresFaceVerification = validReferenceEmbedding !== null;

  // Load face models (likely already preloaded)
  useEffect(() => {
    loadFaceModels()
      .then(() => {
        setModelsLoading(false);
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

  const stopCamera = useCallback(() => {
    // Stop all tracks via ref (always current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Also clean state-based stream
    setStream(prev => {
      if (prev) prev.getTracks().forEach(track => track.stop());
      return null;
    });
    // Cancel any pending detection frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // Detach video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start camera when models are ready
  useEffect(() => {
    if (!modelsLoading) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [modelsLoading]);

  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
        audio: false
      });
      
      streamRef.current = mediaStream;
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsLoading(false);
          // Wait for camera stream to stabilize before starting detection
          setTimeout(() => startFaceDetection(), 500);
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please grant permission.');
      setIsLoading(false);
    }
  };

  // Simple face detection loop - auto captures when face is detected
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

          // Auto capture when held for enough frames (quick)
          if (faceFrameCountRef.current >= FACE_HOLD_FRAMES && !captureTriggeredRef.current) {
            captureTriggeredRef.current = true;
            setIsCapturing(true);
            await captureAndVerify();
            return;
          }
        } else {
          // Reset if face lost
          faceFrameCountRef.current = 0;
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
    
    // Immediately stop camera - detection is done
    stopCamera();

    // Verify face if reference exists
    if (requiresFaceVerification && validReferenceEmbedding) {
      setIsVerifying(true);
      
      try {
        const capturedEmbedding = await extractFaceEmbedding(canvas);
        
        if (!capturedEmbedding) {
          setVerificationResult({ match: false, confidence: 0 });
          setVerificationComplete(true);
          setIsVerifying(false);
          // Auto close after delay
          setTimeout(() => onCapture(dataUrl, false), 1500);
          return;
        }

        const similarityThreshold = confidenceThreshold / 100;
        const result = compareFaceEmbeddings(validReferenceEmbedding, capturedEmbedding, similarityThreshold);
        
        setVerificationResult({ match: result.match, confidence: result.confidence });
        setVerificationComplete(true);
        setIsVerifying(false);
        
        // Auto-confirm after short delay
        setTimeout(() => {
          onCapture(dataUrl, result.match);
        }, result.match ? 800 : 1500);
        
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationResult({ match: false, confidence: 0 });
        setVerificationComplete(true);
        setIsVerifying(false);
        setTimeout(() => onCapture(dataUrl, false), 1500);
      }
    } else {
      // No verification needed, just capture
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
        <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
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
            style={{ transform: 'scaleX(-1)', objectPosition: 'center center' }}
          />

          {/* Face Guide Overlay - only show when not capturing */}
          {!error && !verificationComplete && !isCapturing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-60 border-2 border-dashed rounded-full border-white/50" />
            </div>
          )}

          {/* Status Overlay - only show during verification or after complete */}
          {!error && (isVerifying || verificationComplete) && (
            <div className="absolute top-4 left-4 right-4">
              <div className={`backdrop-blur rounded-lg p-3 ${
                verificationComplete 
                  ? verificationResult?.match ? 'bg-success/90' : 'bg-destructive/90'
                  : 'bg-black/70'
              }`}>
                <div className="flex items-center gap-3">
                  {verificationComplete ? (
                    verificationResult?.match ? (
                      <ShieldCheck className="w-5 h-5 text-white" />
                    ) : (
                      <ShieldX className="w-5 h-5 text-white" />
                    )
                  ) : (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  )}
                  <span className="text-white text-sm font-medium flex-1">
                    {verificationComplete 
                      ? (verificationResult?.match ? 'Face verified!' : 'Face not matched')
                      : 'Verifying...'}
                  </span>
                  {verificationComplete && verificationResult && (
                    <span className="text-white/80 text-xs">
                      {verificationResult.confidence}%
                    </span>
                  )}
                </div>
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
              : 'Position your face in the frame'
            }
          </p>
        </div>
      </Card>
    </div>
  );
}
