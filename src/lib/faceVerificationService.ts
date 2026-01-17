/**
 * Face Verification Service Abstraction Layer
 * 
 * This module provides a unified interface for face verification,
 * abstracting the underlying provider (currently Lovable AI Gateway).
 * 
 * To swap providers:
 * 1. Implement the FaceProvider interface for your new provider
 * 2. Update the createFaceProvider factory function
 * 3. Set the appropriate ENV variables
 * 
 * ENV Variables:
 * - FACE_PROVIDER: 'lovable' (default) | 'aws' | 'azure' | 'custom'
 * - For custom providers, set additional vars as needed
 */

import { supabase } from '@/integrations/supabase/client';

export interface FaceVerificationResult {
  success: boolean;
  match: boolean;
  confidence: number;
  isLive: boolean;
  spoofDetected: boolean;
  reason: string;
  error?: string;
  code?: string;
}

export interface FaceRegistrationResult {
  success: boolean;
  imagesStored: number;
  error?: string;
}

export interface ChallengeToken {
  token: string;
  expiresAt: string;
}

export interface AttendanceVerificationParams {
  challengeToken: string;
  capturedImage: string;
  latitude: number;
  longitude: number;
  gpsTimestamp: string;
  action: 'check-in' | 'check-out';
}

export interface AttendanceResult {
  success: boolean;
  action: 'check-in' | 'check-out';
  timestamp: string;
  faceConfidence: number;
  location: { latitude: number; longitude: number };
  error?: string;
  code?: string;
}

/**
 * Generate a one-time challenge token for anti-replay protection
 */
export async function generateChallengeToken(): Promise<ChallengeToken> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) {
    throw new Error('User not authenticated');
  }

  const response = await supabase.functions.invoke('generate-challenge', {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to generate challenge');
  }

  return {
    token: response.data.token,
    expiresAt: response.data.expires_at,
  };
}

/**
 * Register employee face with multiple images
 */
export async function registerFace(images: string[]): Promise<FaceRegistrationResult> {
  if (images.length < 3 || images.length > 5) {
    return {
      success: false,
      imagesStored: 0,
      error: 'Please provide 3-5 face images',
    };
  }

  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) {
    return {
      success: false,
      imagesStored: 0,
      error: 'User not authenticated',
    };
  }

  const response = await supabase.functions.invoke('register-face', {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    body: { images },
  });

  if (response.error) {
    return {
      success: false,
      imagesStored: 0,
      error: response.error.message || 'Face registration failed',
    };
  }

  return {
    success: response.data.success,
    imagesStored: response.data.images_stored || 0,
    error: response.data.error,
  };
}

/**
 * Verify attendance with face and GPS validation
 */
export async function verifyAttendance(
  params: AttendanceVerificationParams
): Promise<AttendanceResult> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) {
    return {
      success: false,
      action: params.action,
      timestamp: '',
      faceConfidence: 0,
      location: { latitude: 0, longitude: 0 },
      error: 'User not authenticated',
      code: 'AUTH_REQUIRED',
    };
  }

  const response = await supabase.functions.invoke('verify-attendance', {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    body: {
      challenge_token: params.challengeToken,
      captured_image: params.capturedImage,
      latitude: params.latitude,
      longitude: params.longitude,
      gps_timestamp: params.gpsTimestamp,
      action: params.action,
    },
  });

  if (response.error) {
    // Parse error response
    const errorData = response.error.message ? 
      (typeof response.error.message === 'string' ? 
        (() => { try { return JSON.parse(response.error.message); } catch { return { error: response.error.message }; } })() 
        : response.error) 
      : { error: 'Unknown error' };
    
    return {
      success: false,
      action: params.action,
      timestamp: '',
      faceConfidence: 0,
      location: { latitude: 0, longitude: 0 },
      error: errorData.error || 'Verification failed',
      code: errorData.code || 'VERIFICATION_FAILED',
    };
  }

  if (!response.data.success) {
    return {
      success: false,
      action: params.action,
      timestamp: '',
      faceConfidence: 0,
      location: { latitude: 0, longitude: 0 },
      error: response.data.error || 'Verification failed',
      code: response.data.code || 'VERIFICATION_FAILED',
    };
  }

  return {
    success: true,
    action: response.data.action,
    timestamp: response.data.timestamp,
    faceConfidence: response.data.face_confidence,
    location: response.data.location,
  };
}

/**
 * Get current GPS position with strict validation
 */
export function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date(position.timestamp).toISOString(),
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let errorMessage = 'Location access denied';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable GPS.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable. Please check GPS settings.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // Force fresh location
      }
    );
  });
}
