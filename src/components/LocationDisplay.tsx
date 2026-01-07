import { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';

interface LocationDisplayProps {
  latitude: number | null;
  longitude: number | null;
  showCoordinates?: boolean;
  className?: string;
}

export default function LocationDisplay({ 
  latitude, 
  longitude, 
  showCoordinates = false,
  className = '' 
}: LocationDisplayProps) {
  const [address, setAddress] = useState<string | null>(null);
  const { getAddress, isLoading } = useReverseGeocode();

  useEffect(() => {
    if (latitude && longitude && latitude !== 0 && longitude !== 0) {
      getAddress(latitude, longitude).then((result) => {
        if (result) {
          setAddress(result.formatted);
        }
      });
    }
  }, [latitude, longitude, getAddress]);

  if (!latitude || !longitude || (latitude === 0 && longitude === 0)) {
    return (
      <div className={`flex items-center gap-1.5 text-muted-foreground text-xs ${className}`}>
        <MapPin className="w-3 h-3" />
        <span>Location not available</span>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-1.5 ${className}`}>
      <MapPin className="w-3 h-3 mt-0.5 text-primary shrink-0" />
      <div className="min-w-0">
        {isLoading ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading address...</span>
          </div>
        ) : address ? (
          <p className="text-xs text-foreground leading-relaxed">{address}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
        )}
        {showCoordinates && address && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}
