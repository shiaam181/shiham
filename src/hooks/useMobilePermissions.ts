import { useState, useCallback } from 'react';
import { requestCameraPermission, requestLocationPermission } from '@/lib/mobileUtils';

export interface PermissionState {
  camera: 'unknown' | 'granted' | 'denied';
  location: 'unknown' | 'granted' | 'denied';
  cameraError?: string;
  locationError?: string;
  isChecking: boolean;
}

export function useMobilePermissions() {
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: 'unknown',
    location: 'unknown',
    isChecking: false,
  });

  const checkCamera = useCallback(async () => {
    setPermissions(p => ({ ...p, isChecking: true }));
    const result = await requestCameraPermission();
    setPermissions(p => ({
      ...p,
      camera: result.granted ? 'granted' : 'denied',
      cameraError: result.error,
      isChecking: false,
    }));
    return result.granted;
  }, []);

  const checkLocation = useCallback(async () => {
    setPermissions(p => ({ ...p, isChecking: true }));
    const result = await requestLocationPermission();
    setPermissions(p => ({
      ...p,
      location: result.granted ? 'granted' : 'denied',
      locationError: result.error,
      isChecking: false,
    }));
    return result.granted;
  }, []);

  const checkAll = useCallback(async () => {
    setPermissions(p => ({ ...p, isChecking: true }));
    const [cam, loc] = await Promise.all([
      requestCameraPermission(),
      requestLocationPermission(),
    ]);
    setPermissions({
      camera: cam.granted ? 'granted' : 'denied',
      location: loc.granted ? 'granted' : 'denied',
      cameraError: cam.error,
      locationError: loc.error,
      isChecking: false,
    });
    return { camera: cam.granted, location: loc.granted };
  }, []);

  return { permissions, checkCamera, checkLocation, checkAll };
}
