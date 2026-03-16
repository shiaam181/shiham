import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface LiveTrackingState {
  globalEnabled: boolean;
  companyEnabled: boolean;
  trackingInterval: number;
  autoPunchoutOnLocationOff: boolean;
  isLoading: boolean;
}

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export function useLiveTracking() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<LiveTrackingState>({
    globalEnabled: false,
    companyEnabled: false,
    trackingInterval: 60,
    autoPunchoutOnLocationOff: false,
    isLoading: true,
  });
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trackingIntervalRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const locationFailCountRef = useRef(0);
  const locationWarningShownRef = useRef(false);
  const autoPunchoutTriggeredRef = useRef(false);

  // How many consecutive failures before warning / auto-punchout
  const WARN_AFTER_FAILURES = 2;
  const PUNCHOUT_AFTER_FAILURES = 4;

  // Fetch tracking settings
  const fetchSettings = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Get global setting + auto-punchout setting in parallel
      const [globalRes, autoPunchoutRes] = await Promise.all([
        supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'live_tracking_enabled')
          .maybeSingle(),
        supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'auto_punchout_location_off')
          .maybeSingle(),
      ]);

      const globalEnabled = (globalRes.data?.value as { enabled?: boolean })?.enabled ?? false;
      const autoPunchoutOnLocationOff = (autoPunchoutRes.data?.value as { enabled?: boolean })?.enabled ?? false;

      // Get company setting
      let companyEnabled = true;
      let trackingInterval = 60;
      
      if (profile?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('live_tracking_enabled, tracking_interval_seconds')
          .eq('id', profile.company_id)
          .single();

        companyEnabled = company?.live_tracking_enabled ?? false;
        trackingInterval = company?.tracking_interval_seconds ?? 60;
      }

      setState({
        globalEnabled,
        companyEnabled,
        trackingInterval,
        autoPunchoutOnLocationOff,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error fetching live tracking settings:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user, profile?.company_id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle location failure (user turned off GPS)
  const handleLocationError = useCallback((err: GeolocationPositionError) => {
    setError(err.message);
    locationFailCountRef.current += 1;

    const failCount = locationFailCountRef.current;

    // Show warning after first few failures
    if (failCount >= WARN_AFTER_FAILURES && !locationWarningShownRef.current && state.autoPunchoutOnLocationOff) {
      locationWarningShownRef.current = true;
      toast({
        title: '⚠️ Location Turned Off',
        description: 'Your location is off. If it stays off, you will be automatically punched out.',
        variant: 'destructive',
      });
    }

    // Trigger auto punch-out after sustained failure
    if (failCount >= PUNCHOUT_AFTER_FAILURES && state.autoPunchoutOnLocationOff && !autoPunchoutTriggeredRef.current) {
      autoPunchoutTriggeredRef.current = true;
      triggerAutoPunchout();
    }
  }, [state.autoPunchoutOnLocationOff]);

  // Reset fail count on successful location
  const handleLocationSuccess = useCallback((position: GeolocationPosition) => {
    locationFailCountRef.current = 0;
    locationWarningShownRef.current = false;
    autoPunchoutTriggeredRef.current = false;

    sendLocationUpdate({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed ?? undefined,
      heading: position.coords.heading ?? undefined,
    });
  }, []);

  // Auto punch-out via edge function
  const triggerAutoPunchout = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('auto-punchout', {
        body: { reason: 'Auto punch-out: Location services were turned off by employee.' },
      });

      if (error) throw error;

      if (data?.success) {
        // Stop tracking
        stopTrackingSilentInternal();
        toast({
          title: '🚫 Auto Punch-Out',
          description: 'You were punched out because your location services were turned off.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.error('Auto punch-out error:', err);
    }
  }, []);

  // Send location update to backend
  const sendLocationUpdate = useCallback(async (location: LocationUpdate) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('update-live-location', {
        body: location,
      });

      if (error) throw error;

      if (data?.success) {
        setLastUpdate(new Date());
        setError(null);
      } else {
        throw new Error(data?.error || 'Failed to update location');
      }
    } catch (err: any) {
      console.error('Location update error:', err);
      setError(err.message);
    }
  }, [user]);

  // Internal stop tracking
  const stopTrackingSilentInternal = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    locationFailCountRef.current = 0;
    locationWarningShownRef.current = false;
    autoPunchoutTriggeredRef.current = false;
  }, []);

  // Internal start tracking (silent - used for auto-start on check-in)
  const startTrackingInternal = useCallback(() => {
    if (!state.globalEnabled || !state.companyEnabled) return;
    if (!navigator.geolocation) {
      setError('Your browser does not support location services.');
      return;
    }
    if (isTracking) return;

    setIsTracking(true);
    setError(null);
    locationFailCountRef.current = 0;
    locationWarningShownRef.current = false;
    autoPunchoutTriggeredRef.current = false;

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      handleLocationSuccess,
      handleLocationError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Set up interval for periodic updates
    trackingIntervalRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        handleLocationSuccess,
        handleLocationError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }, state.trackingInterval * 1000);
  }, [state, handleLocationSuccess, handleLocationError, isTracking]);

  // Manual start tracking (with toast)
  const startTracking = useCallback(() => {
    if (!state.globalEnabled || !state.companyEnabled) {
      toast({
        title: 'Cannot Start Tracking',
        description: 'Live tracking is not enabled.',
        variant: 'destructive',
      });
      return;
    }

    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation Not Supported',
        description: 'Your browser does not support location services.',
        variant: 'destructive',
      });
      return;
    }

    startTrackingInternal();

    toast({
      title: 'Live Tracking Started',
      description: `Your location will be updated every ${state.trackingInterval} seconds.`,
    });
  }, [state, startTrackingInternal, toast]);

  // Stop tracking (with toast)
  const stopTracking = useCallback(() => {
    stopTrackingSilentInternal();
    
    toast({
      title: 'Live Tracking Stopped',
      description: 'Your location is no longer being shared.',
    });
  }, [stopTrackingSilentInternal, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const canTrack = state.globalEnabled && state.companyEnabled;

  return {
    ...state,
    isTracking,
    lastUpdate,
    error,
    canTrack,
    startTracking,
    startTrackingSilent: startTrackingInternal,
    stopTracking,
    stopTrackingSilent: stopTrackingSilentInternal,
    refetch: fetchSettings,
  };
}
