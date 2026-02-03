import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface LiveTrackingState {
  globalEnabled: boolean;
  companyEnabled: boolean;
  consented: boolean;
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
    consented: false,
    trackingInterval: 60,
    isLoading: true,
  });
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trackingIntervalRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Fetch tracking settings
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

      // Get company setting if user has a company
      // If user has no company (developer/owner), treat company as enabled by default
      let companyEnabled = true; // Default to true for users without company
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

      // Get user consent
      const { data: consent, error: consentError } = await supabase
        .from('employee_consent')
        .select('location_tracking_consented')
        .eq('user_id', user.id)
        .maybeSingle();

      if (consentError) {
        console.error('Error fetching consent:', consentError);
      }

      setState({
        globalEnabled,
        companyEnabled,
        consented: consent?.location_tracking_consented ?? false,
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

  // Update consent
  const updateConsent = async (consented: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('employee_consent')
        .upsert({
          user_id: user.id,
          location_tracking_consented: consented,
          consented_at: consented ? new Date().toISOString() : null,
          revoked_at: consented ? null : new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setState(prev => ({ ...prev, consented }));

      toast({
        title: consented ? 'Location Tracking Enabled' : 'Location Tracking Disabled',
        description: consented 
          ? 'Your location will be shared while tracking is active.'
          : 'Your location will no longer be shared.',
      });

      // Stop tracking if consent revoked
      if (!consented && isTracking) {
        stopTracking();
      }
    } catch (err: any) {
      console.error('Error updating consent:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update consent',
        variant: 'destructive',
      });
    }
  };

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

  // Start tracking
  const startTracking = useCallback(() => {
    if (!state.globalEnabled || !state.companyEnabled || !state.consented) {
      toast({
        title: 'Cannot Start Tracking',
        description: 'Live tracking must be enabled and you must provide consent.',
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
        toast({
          title: 'Location Error',
          description: err.message,
          variant: 'destructive',
        });
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

    toast({
      title: 'Live Tracking Started',
      description: `Your location will be updated every ${state.trackingInterval} seconds.`,
    });
  }, [state, sendLocationUpdate, toast]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    
    toast({
      title: 'Live Tracking Stopped',
      description: 'Your location is no longer being shared.',
    });
  }, [toast]);

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

  // Check if tracking should be active
  const canTrack = state.globalEnabled && state.companyEnabled && state.consented;

  return {
    ...state,
    isTracking,
    lastUpdate,
    error,
    canTrack,
    updateConsent,
    startTracking,
    stopTracking,
    refetch: fetchSettings,
  };
}
