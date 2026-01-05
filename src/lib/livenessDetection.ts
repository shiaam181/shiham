import * as faceapi from 'face-api.js';

export interface LivenessState {
  isLive: boolean;
  smileDetected: boolean;
  status: 'waiting' | 'detecting' | 'smile_detected' | 'verified' | 'failed';
  message: string;
  progress: number; // 0-100
}

const SMILE_THRESHOLD = 0.7; // Minimum smile probability to detect
const SMILE_HOLD_FRAMES = 5; // Number of consecutive frames with smile needed
const MAX_DETECTION_TIME = 20000; // 20 seconds to complete

// Load face expression model
let expressionModelLoaded = false;
let expressionModelLoading = false;

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

export async function loadExpressionModel(): Promise<void> {
  if (expressionModelLoaded) return;
  if (expressionModelLoading) {
    while (expressionModelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  expressionModelLoading = true;
  try {
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    expressionModelLoaded = true;
    console.log('Face expression model loaded successfully');
  } catch (error) {
    console.error('Failed to load expression model:', error);
    throw error;
  } finally {
    expressionModelLoading = false;
  }
}

export class LivenessDetector {
  private smileFrameCount = 0;
  private startTime: number | null = null;
  private isVerified = false;
  private smileDetected = false;

  reset() {
    this.smileFrameCount = 0;
    this.startTime = null;
    this.isVerified = false;
    this.smileDetected = false;
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
        smileDetected: this.smileDetected,
        status: 'failed',
        message: 'Liveness check timed out. Please try again.',
        progress: 100,
      };
    }

    if (this.isVerified) {
      return {
        isLive: true,
        smileDetected: true,
        status: 'verified',
        message: 'Liveness verified! You may capture now.',
        progress: 100,
      };
    }

    try {
      // Ensure expression model is loaded
      await loadExpressionModel();

      // Detect face with expressions
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceExpressions();

      if (!detection) {
        return {
          isLive: false,
          smileDetected: this.smileDetected,
          status: 'detecting',
          message: 'Position your face in the frame',
          progress: 0,
        };
      }

      const expressions = detection.expressions;
      const smileProbability = expressions.happy;

      console.log(`Smile probability: ${(smileProbability * 100).toFixed(1)}%`);

      // Check if smiling
      if (smileProbability >= SMILE_THRESHOLD) {
        this.smileFrameCount++;
        this.smileDetected = true;
        
        // Need sustained smile for verification
        if (this.smileFrameCount >= SMILE_HOLD_FRAMES) {
          this.isVerified = true;
          return {
            isLive: true,
            smileDetected: true,
            status: 'verified',
            message: 'Liveness verified! You may capture now.',
            progress: 100,
          };
        }

        const progress = (this.smileFrameCount / SMILE_HOLD_FRAMES) * 100;
        return {
          isLive: false,
          smileDetected: true,
          status: 'smile_detected',
          message: `Keep smiling... ${Math.round(progress)}%`,
          progress,
        };
      } else {
        // Reset count if smile drops
        this.smileFrameCount = Math.max(0, this.smileFrameCount - 1);
        
        return {
          isLive: false,
          smileDetected: this.smileDetected,
          status: 'waiting',
          message: '😊 Please smile to verify you\'re real',
          progress: (this.smileFrameCount / SMILE_HOLD_FRAMES) * 100,
        };
      }

    } catch (error) {
      console.error('Liveness detection error:', error);
      return {
        isLive: false,
        smileDetected: this.smileDetected,
        status: 'detecting',
        message: 'Detecting face...',
        progress: 0,
      };
    }
  }

  getIsVerified(): boolean {
    return this.isVerified;
  }

  getSmileDetected(): boolean {
    return this.smileDetected;
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
