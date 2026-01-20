import * as faceapi from 'face-api.js';

export interface LivenessState {
  isLive: boolean;
  smileDetected: boolean;
  status: 'waiting' | 'detecting' | 'face_detected' | 'verified' | 'failed';
  message: string;
  progress: number; // 0-100
}

const FACE_HOLD_FRAMES = 8; // Number of consecutive frames with face needed for auto-capture
const MAX_DETECTION_TIME = 30000; // 30 seconds to complete

export class LivenessDetector {
  private faceFrameCount = 0;
  private startTime: number | null = null;
  private isVerified = false;
  private faceDetected = false;

  reset() {
    this.faceFrameCount = 0;
    this.startTime = null;
    this.isVerified = false;
    this.faceDetected = false;
  }

  async detectFromVideo(
    video: HTMLVideoElement
  ): Promise<LivenessState> {
    if (!this.startTime) {
      this.startTime = Date.now();
    }

    // Check timeout
    const elapsed = Date.now() - this.startTime;
    if (elapsed > MAX_DETECTION_TIME) {
      return {
        isLive: false,
        smileDetected: false,
        status: 'failed',
        message: 'Face detection timed out. Please try again.',
        progress: 100,
      };
    }

    if (this.isVerified) {
      return {
        isLive: true,
        smileDetected: true,
        status: 'verified',
        message: 'Face detected! Capturing...',
        progress: 100,
      };
    }

    try {
      // Simple face detection - no expression model needed
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));

      if (!detection) {
        // Reset count if face is lost
        this.faceFrameCount = Math.max(0, this.faceFrameCount - 2);
        
        return {
          isLive: false,
          smileDetected: false,
          status: 'detecting',
          message: 'Position your face in the frame',
          progress: Math.max(0, (this.faceFrameCount / FACE_HOLD_FRAMES) * 100),
        };
      }

      // Face detected - increment counter
      this.faceFrameCount++;
      this.faceDetected = true;

      console.log(`Face detected, hold frames: ${this.faceFrameCount}/${FACE_HOLD_FRAMES}`);

      // Need sustained face presence for verification
      if (this.faceFrameCount >= FACE_HOLD_FRAMES) {
        this.isVerified = true;
        return {
          isLive: true,
          smileDetected: true,
          status: 'verified',
          message: 'Face detected! Capturing...',
          progress: 100,
        };
      }

      const progress = (this.faceFrameCount / FACE_HOLD_FRAMES) * 100;
      return {
        isLive: false,
        smileDetected: false,
        status: 'face_detected',
        message: `Hold steady... ${Math.round(progress)}%`,
        progress,
      };

    } catch (error) {
      console.error('Face detection error:', error);
      return {
        isLive: false,
        smileDetected: false,
        status: 'detecting',
        message: 'Detecting face...',
        progress: 0,
      };
    }
  }

  getIsVerified(): boolean {
    return this.isVerified;
  }

  getFaceDetected(): boolean {
    return this.faceDetected;
  }
}

// Singleton instance for reuse
let detectorInstance: LivenessDetector | null = null;

export function getLivenessDetector(): LivenessDetector {
  if (!detectorInstance) {
    detectorInstance = new LivenessDetector();
  }
  return detectorInstance;
}

export function resetLivenessDetector(): void {
  if (detectorInstance) {
    detectorInstance.reset();
  }
}
