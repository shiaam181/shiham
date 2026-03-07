import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GeofenceStatusIndicatorProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  onStatusChange?: (isInside: boolean, locationName?: string) => void;
  onDisabled?: () => void;
}

export default function GeofenceStatusIndicator({
  latitude,
  longitude,
  accuracy,
  onStatusChange,
  onDisabled,
}: GeofenceStatusIndicatorProps) {
  const [status, setStatus] = useState<'checking' | 'inside' | 'outside' | 'disabled' | 'error'>('checking');
  const [locationName, setLocationName] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (latitude === null || longitude === null || latitude === 0) {
      setStatus('disabled');
      onDisabled?.();
      return;
    }

    const checkGeofence = async () => {
      setIsChecking(true);
      try {
        const { data, error } = await supabase.functions.invoke('evaluate-geofence', {
          body: { latitude, longitude, accuracy },
        });

        if (error) throw error;

        if (!data.geofencingEnabled) {
          setStatus('disabled');
          onStatusChange?.(true);
          onDisabled?.();
          return;
        }

        if (data.isInside) {
          setStatus('inside');
          setLocationName(data.matchedLocation?.name || '');
          setDistance(data.matchedLocation?.distance || 0);
          onStatusChange?.(true, data.matchedLocation?.name);
        } else {
          setStatus('outside');
          setLocationName(data.nearestLocation || '');
          setDistance(data.distanceMeters || null);
          onStatusChange?.(false, data.nearestLocation);
        }
      } catch (err) {
        console.error('Geofence check error:', err);
        setStatus('error');
        onStatusChange?.(true); // Allow on error to not block
      } finally {
        setIsChecking(false);
      }
    };

    checkGeofence();
  }, [latitude, longitude, accuracy]);

  if (status === 'disabled') return null;

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border ${
      status === 'inside' ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' :
      status === 'outside' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' :
      status === 'checking' ? 'bg-muted/50 border-border' :
      'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
    }`}>
      {isChecking ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Checking work location...</span>
        </>
      ) : status === 'inside' ? (
        <>
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Inside work zone</p>
            {locationName && (
              <p className="text-xs text-green-600/70 dark:text-green-400/70 truncate">{locationName} ({distance}m away)</p>
            )}
          </div>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
            <MapPin className="w-3 h-3 mr-1" />Inside
          </Badge>
        </>
      ) : status === 'outside' ? (
        <>
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Outside work zone</p>
            {locationName && distance && (
              <p className="text-xs text-red-600/70 dark:text-red-400/70 truncate">{distance}m from {locationName}</p>
            )}
          </div>
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs">
            <MapPin className="w-3 h-3 mr-1" />Outside
          </Badge>
        </>
      ) : (
        <>
          <MapPin className="w-4 h-4 text-yellow-600" />
          <span className="text-sm text-yellow-700">Could not verify location</span>
        </>
      )}
    </div>
  );
}
