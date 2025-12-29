import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, X, RotateCcw, Check, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CameraCaptureProps {
  onCapture: (photoDataUrl: string, faceVerified: boolean) => void;
  onClose: () => void;
  type: 'check-in' | 'check-out';
  referenceImageUrl?: string | null;
}

export default function CameraCapture({ onCapture, onClose, type, referenceImageUrl }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [verificationResult, setVerificationResult] = useState<{
    match: boolean;
    confidence: number;
    reason: string;
  } | null>(null);

  // Fetch the confidence threshold from system settings
  useEffect(() => {
    const fetchThreshold = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'face_verification_threshold')
        .maybeSingle();
      
      if (data?.value) {
        const threshold = (data.value as { threshold?: number })?.threshold ?? 70;
        setConfidenceThreshold(threshold);
      }
    };
    fetchThreshold();
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

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
    
    // Mirror the image for selfie camera
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    stopCamera();

    // If we have a reference image, verify face
    if (referenceImageUrl) {
      await verifyFace(dataUrl);
    }
  };

  const verifyFace = async (capturedDataUrl: string) => {
    if (!referenceImageUrl) {
      setVerificationResult({ match: true, confidence: 100, reason: 'No reference photo set - verification skipped' });
      return;
    }

    setIsVerifying(true);
    try {
      // Convert reference image to base64 if it's a storage URL
      let referenceBase64 = referenceImageUrl;
      
      if (referenceImageUrl.includes('supabase.co/storage')) {
        // Get signed URL for private bucket
        const urlParts = referenceImageUrl.split('/employee-photos/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          const { data: signedData, error: signedError } = await supabase.storage
            .from('employee-photos')
            .createSignedUrl(filePath, 300); // 5 min expiry
          
          if (signedError || !signedData?.signedUrl) {
            console.error('Failed to get signed URL:', signedError);
            throw new Error('Could not load reference image');
          }
          
          // Fetch the image and convert to base64
          const response = await fetch(signedData.signedUrl);
          const blob = await response.blob();
          referenceBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      }

      const { data, error } = await supabase.functions.invoke('verify-face', {
        body: {
          referenceImage: referenceBase64,
          capturedImage: capturedDataUrl,
        },
      });

      if (error) throw error;

      setVerificationResult(data);
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
      // Check if confidence meets the threshold
      const meetsThreshold = verificationResult ? verificationResult.confidence >= confidenceThreshold : false;
      const faceVerified = referenceImageUrl ? meetsThreshold : true;
      onCapture(capturedImage, faceVerified);
    }
  };

  // Face must meet threshold if reference exists - no bypass allowed
  const meetsThreshold = verificationResult ? verificationResult.confidence >= confidenceThreshold : false;
  const canConfirm = !referenceImageUrl || meetsThreshold;

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
          {capturedImage && referenceImageUrl && (
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
          {referenceImageUrl 
            ? 'Face verification will be performed automatically'
            : 'Position your face within the guide for best results'
          }
        </p>
      </Card>
    </div>
  );
}
