import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, RefreshCw, Users, Clock, Loader2, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { useLiveLocations, EmployeeLocation } from '@/hooks/useLiveLocations';
import { format, formatDistanceToNow } from 'date-fns';

interface LiveLocationMapProps {
  companyId?: string;
  isDeveloper?: boolean;
  companies?: Array<{ id: string; name: string }>;
}

export function LiveLocationMap({ companyId, isDeveloper, companies = [] }: LiveLocationMapProps) {
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(companyId);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  const { locations, isLoading, error, lastFetch, refetch } = useLiveLocations(
    selectedCompany,
    30000 // Refresh every 30 seconds
  );

  // Initialize AWS Location Service map
  const initializeMap = useCallback(async () => {
    if (!mapContainerRef.current) return;

    try {
      setIsMapLoading(true);
      setMapError(null);

      // Check if AWS credentials are configured
      const awsRegion = import.meta.env.VITE_AWS_REGION || 'ap-south-1';
      const mapName = import.meta.env.VITE_AWS_LOCATION_MAP_NAME;

      if (!mapName) {
        setMapError('AWS Location Service map not configured. Please configure AWS credentials.');
        setIsMapLoading(false);
        return;
      }

      // For now, we'll use a simple fallback map representation
      // AWS Location Service requires SDK setup which needs more configuration
      console.log('Map would initialize with:', { awsRegion, mapName });
      setIsMapLoading(false);
    } catch (err: any) {
      console.error('Map initialization error:', err);
      setMapError(err.message || 'Failed to load map');
      setIsMapLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeMap();
    
    return () => {
      // Cleanup map instance
      if (mapInstanceRef.current) {
        // mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initializeMap]);

  // Group locations by recency
  const categorizedLocations = {
    active: locations.filter(l => {
      const recordedAt = new Date(l.recorded_at);
      const minutesAgo = (Date.now() - recordedAt.getTime()) / 1000 / 60;
      return minutesAgo <= 5;
    }),
    recent: locations.filter(l => {
      const recordedAt = new Date(l.recorded_at);
      const minutesAgo = (Date.now() - recordedAt.getTime()) / 1000 / 60;
      return minutesAgo > 5 && minutesAgo <= 30;
    }),
    stale: locations.filter(l => {
      const recordedAt = new Date(l.recorded_at);
      const minutesAgo = (Date.now() - recordedAt.getTime()) / 1000 / 60;
      return minutesAgo > 30;
    }),
  };

  const getLocationStatus = (recordedAt: string) => {
    const time = new Date(recordedAt);
    const minutesAgo = (Date.now() - time.getTime()) / 1000 / 60;
    
    if (minutesAgo <= 5) return { label: 'Active', color: 'bg-green-500' };
    if (minutesAgo <= 30) return { label: 'Recent', color: 'bg-yellow-500' };
    return { label: 'Stale', color: 'bg-gray-400' };
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Live Employee Locations</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isDeveloper && companies.length > 0 && (
              <Select value={selectedCompany || ''} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Companies</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {locations.length} tracked
          </span>
          {lastFetch && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {formatDistanceToNow(lastFetch, { addSuffix: true })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Map Container - Placeholder for AWS Location Service */}
        <div 
          ref={mapContainerRef}
          className="relative w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden bg-muted mb-4"
        >
          {isMapLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : mapError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <WifiOff className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">{mapError}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Configure AWS Location Service to view the map
              </p>
            </div>
          ) : locations.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No active locations</p>
              <p className="text-xs text-muted-foreground mt-2">
                Employees with live tracking enabled will appear here
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
              <Wifi className="w-12 h-12 text-blue-500 mb-4" />
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {locations.length} Employee{locations.length !== 1 ? 's' : ''} Tracked
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                AWS Location Service map will display here when configured
              </p>
            </div>
          )}
        </div>

        {/* Employee List */}
        {locations.length > 0 && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {locations.map((location) => {
              const status = getLocationStatus(location.recorded_at);
              return (
                <div
                  key={location.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                    <div>
                      <p className="text-sm font-medium">{location.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {location.department || 'No department'} • {location.position || 'No position'}
                      </p>
                      {isDeveloper && location.company_name && (
                        <p className="text-xs text-primary">{location.company_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-xs">
                      {status.label}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(location.recorded_at), 'hh:mm a')}
                    </p>
                    {location.accuracy && (
                      <p className="text-xs text-muted-foreground">
                        ±{Math.round(location.accuracy)}m
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
