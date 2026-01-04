import * as faceapi from 'face-api.js';

/**
 * Eye Aspect Ratio (EAR) calculation for blink detection
 * EAR drops significantly when eyes are closed
 */
function calculateEAR(eye: faceapi.Point[]): number {
  // Eye landmarks order: 0-5 for each eye
  // Vertical distances
  const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  // Horizontal distance
  const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  
  if (h === 0) return 0;
  return (v1 + v2) / (2.0 * h);
}

export interface LivenessState {
  isLive: boolean;
  blinkCount: number;
  status: 'waiting' | 'detecting' | 'blink_detected' | 'verified' | 'failed';
  message: string;
  progress: number; // 0-100
}

const EAR_THRESHOLD = 0.21; // Below this = eyes closed
const REQUIRED_BLINKS = 1;
const MAX_DETECTION_TIME = 15000; // 15 seconds to complete

export class LivenessDetector {
  private blinkCount = 0;
  private wasEyesClosed = false;
  private earHistory: number[] = [];
  private startTime: number | null = null;
  private isVerified = false;
  private lastEAR = 0;

  reset() {
    this.blinkCount = 0;
    this.wasEyesClosed = false;
    this.earHistory = [];
    this.startTime = null;
    this.isVerified = false;
    this.lastEAR = 0;
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
        blinkCount: this.blinkCount,
        status: 'failed',
        message: 'Liveness check timed out. Please try again.',
        progress: 100,
      };
    }

    if (this.isVerified) {
      return {
        isLive: true,
        blinkCount: this.blinkCount,
        status: 'verified',
        message: 'Liveness verified! You may capture now.',
        progress: 100,
      };
    }

    try {
      // Detect face with landmarks
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks();

      if (!detection) {
        return {
          isLive: false,
          blinkCount: this.blinkCount,
          status: 'detecting',
          message: 'Position your face in the frame',
          progress: Math.min(50, (this.blinkCount / REQUIRED_BLINKS) * 100),
        };
      }

      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();

      // Calculate EAR for both eyes
      const leftEAR = calculateEAR(leftEye);
      const rightEAR = calculateEAR(rightEye);
      const avgEAR = (leftEAR + rightEAR) / 2;
      
      this.lastEAR = avgEAR;
      this.earHistory.push(avgEAR);
      
      // Keep last 30 frames (~1 second at 30fps)
      if (this.earHistory.length > 30) {
        this.earHistory.shift();
      }

      // Detect blink: transition from open -> closed -> open
      const eyesClosed = avgEAR < EAR_THRESHOLD;
      
      if (eyesClosed && !this.wasEyesClosed) {
        // Eyes just closed
        this.wasEyesClosed = true;
      } else if (!eyesClosed && this.wasEyesClosed) {
        // Eyes just opened = completed blink
        this.wasEyesClosed = false;
        this.blinkCount++;
        console.log(`Blink detected! Count: ${this.blinkCount}, EAR: ${avgEAR.toFixed(3)}`);
      }

      // Check if liveness verified
      if (this.blinkCount >= REQUIRED_BLINKS) {
        this.isVerified = true;
        return {
          isLive: true,
          blinkCount: this.blinkCount,
          status: 'verified',
          message: 'Liveness verified! You may capture now.',
          progress: 100,
        };
      }

      const progress = (this.blinkCount / REQUIRED_BLINKS) * 100;
      return {
        isLive: false,
        blinkCount: this.blinkCount,
        status: 'waiting',
        message: `Please blink to verify you're real (${this.blinkCount}/${REQUIRED_BLINKS})`,
        progress,
      };

    } catch (error) {
      console.error('Liveness detection error:', error);
      return {
        isLive: false,
        blinkCount: this.blinkCount,
        status: 'detecting',
        message: 'Detecting face...',
        progress: 0,
      };
    }
  }

  getIsVerified(): boolean {
    return this.isVerified;
  }

  getBlinkCount(): number {
    return this.blinkCount;
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
