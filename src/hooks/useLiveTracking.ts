import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface LiveTrackingState {
  globalEnabled: boolean;
  companyEnabled: boolean;
  trackingInterval: number;
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
    isLoading: true,
  });
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trackingIntervalRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Fetch tracking settings (no consent needed)
  const fetchSettings = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Get global setting
      const { data: globalSetting, error: globalError } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'live_tracking_enabled')
        .maybeSingle();

      if (globalError) {
        console.error('Error fetching global setting:', globalError);
      }

      const globalEnabled = (globalSetting?.value as { enabled?: boolean })?.enabled ?? false;

      // Get company setting
      let companyEnabled = true;
      let trackingInterval = 60;
      
      if (profile?.company_id) {
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('live_tracking_enabled, tracking_interval_seconds')
          .eq('id', profile.company_id)
          .single();

        if (companyError) {
          console.error('Error fetching company settings:', companyError);
        }

        companyEnabled = company?.live_tracking_enabled ?? false;
        trackingInterval = company?.tracking_interval_seconds ?? 60;
      }

      setState({
        globalEnabled,
        companyEnabled,
        trackingInterval,
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

  // Internal start tracking (silent - used for auto-start on check-in)
  const startTrackingInternal = useCallback(() => {
    if (!state.globalEnabled || !state.companyEnabled) {
      return;
    }

    if (!navigator.geolocation) {
      setError('Your browser does not support location services.');
      return;
    }

    if (isTracking) return;

    setIsTracking(true);
    setError(null);

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        sendLocationUpdate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
        });
      },
      (err) => {
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Set up interval for periodic updates
    trackingIntervalRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          sendLocationUpdate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed ?? undefined,
            heading: position.coords.heading ?? undefined,
          });
        },
        (err) => {
          setError(err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }, state.trackingInterval * 1000);
  }, [state, sendLocationUpdate, isTracking]);

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

  // Stop tracking (silent version for auto-stop on checkout)
  const stopTrackingSilent = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Stop tracking (with toast)
  const stopTracking = useCallback(() => {
    stopTrackingSilent();
    
    toast({
      title: 'Live Tracking Stopped',
      description: 'Your location is no longer being shared.',
    });
  }, [stopTrackingSilent, toast]);

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

  // canTrack is now just based on global + company settings (no consent needed)
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
    stopTrackingSilent,
    refetch: fetchSettings,
  };
}
