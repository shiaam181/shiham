/**
 * Mobile Utility Functions
 * Centralized helpers for mobile-specific behavior
 */

/** Detect if running inside a Capacitor native shell */
export function isNativeApp(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

/** Detect if running as installed PWA */
export function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

/** Detect iOS specifically */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/** Detect Android specifically */
export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

/** Check if device has a notch / safe-area */
export function hasNotch(): boolean {
  // Check if safe-area-inset-top is non-zero
  const div = document.createElement('div');
  div.style.paddingTop = 'env(safe-area-inset-top, 0px)';
  document.body.appendChild(div);
  const hasSafeArea = parseInt(getComputedStyle(div).paddingTop) > 0;
  document.body.removeChild(div);
  return hasSafeArea;
}

/** Trigger haptic feedback if available (Capacitor) */
export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  try {
    if (navigator.vibrate) {
      const durations = { light: 10, medium: 20, heavy: 40 };
      navigator.vibrate(durations[style]);
    }
  } catch {
    // Silently fail — haptics are non-critical
  }
}

/** Request camera permission with user-friendly error handling */
export async function requestCameraPermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
    });
    // Immediately release the stream
    stream.getTracks().forEach(t => t.stop());
    return { granted: true };
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        granted: false,
        error: 'Camera permission denied. Please enable camera access in your device settings.',
      };
    }
    if (err.name === 'NotFoundError') {
      return {
        granted: false,
        error: 'No camera found on this device.',
      };
    }
    return {
      granted: false,
      error: 'Unable to access camera. Please check your settings.',
    };
  }
}

/** Request location permission with user-friendly error handling */
export function requestLocationPermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ granted: false, error: 'GPS is not supported on this device.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => resolve({ granted: true }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            resolve({
              granted: false,
              error: 'Location permission denied. Please enable GPS in your device settings.',
            });
            break;
          case err.POSITION_UNAVAILABLE:
            resolve({
              granted: false,
              error: 'Location unavailable. Please check your GPS settings.',
            });
            break;
          case err.TIMEOUT:
            resolve({
              granted: false,
              error: 'Location request timed out. Please try again.',
            });
            break;
          default:
            resolve({ granted: false, error: 'Unable to get location.' });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/** Lock screen orientation to portrait (native only) */
export async function lockPortrait(): Promise<void> {
  try {
    if ((screen as any).orientation?.lock) {
      await (screen as any).orientation.lock('portrait');
    }
  } catch {
    // Orientation lock not supported
  }
}

/** Get device pixel ratio for optimal image sizing */
export function getOptimalImageSize(baseWidth: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  return Math.round(baseWidth * dpr);
}
