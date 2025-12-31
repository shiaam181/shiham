import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, X, RotateCcw, Check, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { extractFaceEmbedding, compareFaceEmbeddings, loadFaceModels } from '@/lib/faceRecognition';

interface CameraCaptureProps {
  onCapture: (photoDataUrl: string, faceVerified: boolean) => void;
  onClose: () => void;
  type: 'check-in' | 'check-out';
  referenceEmbedding?: number[] | null;
}

export default function CameraCapture({ onCapture, onClose, type, referenceEmbedding }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(60); // Default threshold (60% ~= cosine similarity 0.6)
  const [verificationResult, setVerificationResult] = useState<{
    match: boolean;
    confidence: number;
    reason: string;
  } | null>(null);

  // Load face models on mount
  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsLoading(false))
      .catch((err) => {
        console.error('Failed to load face models:', err);
        setError('Failed to load face recognition. Please refresh the page.');
        setModelsLoading(false);
      });
  }, []);

  // Fetch the confidence threshold from system settings
  useEffect(() => {
    const fetchThreshold = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'face_verification_threshold')
        .maybeSingle();
      
      if (data?.value) {
        const threshold = (data.value as { threshold?: number })?.threshold ?? 60;
        setConfidenceThreshold(threshold);
      }
    };
    fetchThreshold();
  }, []);

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
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsLoading(false);
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please grant camera permission.');
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw without mirroring for face detection (mirror only for display)
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
    setCapturedImage(dataUrl);
    stopCamera();

    // If we have a reference embedding, verify face locally
    if (referenceEmbedding && referenceEmbedding.length > 0) {
      await verifyFaceLocally(canvas);
    }
  };

  const verifyFaceLocally = async (canvas: HTMLCanvasElement) => {
    if (!referenceEmbedding || referenceEmbedding.length === 0) {
      setVerificationResult({ match: true, confidence: 100, reason: 'No reference embedding - verification skipped' });
      return;
    }

    setIsVerifying(true);
    try {
      // Extract embedding from captured image
      const capturedEmbedding = await extractFaceEmbedding(canvas);
      
      if (!capturedEmbedding) {
        setVerificationResult({
          match: false,
          confidence: 0,
          reason: 'No face detected. Please ensure your face is visible.',
        });
        return;
      }

      // Compare embeddings locally (cosine similarity)
      const similarityThreshold = confidenceThreshold / 100;
      const result = compareFaceEmbeddings(referenceEmbedding, capturedEmbedding, similarityThreshold);
      setVerificationResult(result);
    } catch (error) {
      console.error('Face verification error:', error);
      setVerificationResult({
        match: false,
        confidence: 0,
        reason: 'Face verification failed. Please try again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setVerificationResult(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      const meetsThreshold = verificationResult ? verificationResult.confidence >= confidenceThreshold : false;
      const faceVerified = referenceEmbedding && referenceEmbedding.length > 0 ? meetsThreshold : true;
      onCapture(capturedImage, faceVerified);
    }
  };

  // Face must meet threshold if reference exists - no bypass allowed
  const meetsThreshold = verificationResult ? verificationResult.confidence >= confidenceThreshold : false;
  const canConfirm = !referenceEmbedding || referenceEmbedding.length === 0 || meetsThreshold;

  if (modelsLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
          <h3 className="font-display font-semibold text-lg mb-2">Loading Face Recognition</h3>
          <p className="text-sm text-muted-foreground">Preparing face detection models...</p>
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

          {!capturedImage ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          )}

          {/* Face Guide Overlay */}
          {!capturedImage && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-60 border-2 border-dashed border-white/50 rounded-full" />
            </div>
          )}

          {/* Verification Status */}
          {capturedImage && referenceEmbedding && referenceEmbedding.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4">
              {isVerifying ? (
                <div className="bg-black/70 backdrop-blur rounded-lg p-3 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                  <span className="text-white text-sm">Verifying face...</span>
                </div>
              ) : verificationResult && (
                <div className={`backdrop-blur rounded-lg p-3 flex items-center gap-3 ${
                  meetsThreshold ? 'bg-success/90' : 'bg-destructive/90'
                }`}>
                  {meetsThreshold ? (
                    <ShieldCheck className="w-5 h-5 text-white" />
                  ) : (
                    <ShieldX className="w-5 h-5 text-white" />
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                      {meetsThreshold ? 'Face Verified' : 'Face Not Matched'}
                    </p>
                    <p className="text-white/80 text-xs">
                      {verificationResult.confidence}% confidence (required: {confidenceThreshold}%)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Actions */}
        <div className="p-4 flex gap-3">
          {!capturedImage ? (
            <Button
              variant="hero"
              size="lg"
              className="flex-1"
              onClick={capturePhoto}
              disabled={isLoading || !!error}
            >
              <Camera className="w-5 h-5 mr-2" />
              Capture Photo
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={retakePhoto}
                disabled={isVerifying}
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Retake
              </Button>
              <Button
                variant={canConfirm ? "success" : "destructive"}
                size="lg"
                className="flex-1"
                onClick={confirmPhoto}
                disabled={isVerifying || !canConfirm}
              >
                <Check className="w-5 h-5 mr-2" />
                {isVerifying ? 'Verifying...' : canConfirm ? 'Confirm' : 'Face Not Matched'}
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground pb-4 px-4">
          {referenceEmbedding && referenceEmbedding.length > 0
            ? 'Face verification is performed locally on your device'
            : 'Position your face within the guide for best results'
          }
        </p>
      </Card>
    </div>
  );
}
