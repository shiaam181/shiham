import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MapPin, RefreshCw, Users, Clock, Loader2, AlertTriangle, Wifi, WifiOff, Navigation, ChevronRight, User } from 'lucide-react';
import { useLiveLocations, EmployeeLocation } from '@/hooks/useLiveLocations';
import { format, formatDistanceToNow } from 'date-fns';

interface LiveLocationMapProps {
  companyId?: string;
  isDeveloper?: boolean;
  companies?: Array<{ id: string; name: string }>;
}

// Employee location detail dialog
function EmployeeLocationDialog({ 
  employee, 
  open, 
  onOpenChange 
}: { 
  employee: EmployeeLocation | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  if (!employee) return null;

  const getLocationStatus = (recordedAt: string) => {
    const time = new Date(recordedAt);
    const minutesAgo = (Date.now() - time.getTime()) / 1000 / 60;
    
    if (minutesAgo <= 5) return { label: 'Active', color: 'bg-green-500', textColor: 'text-green-600' };
    if (minutesAgo <= 30) return { label: 'Recent', color: 'bg-yellow-500', textColor: 'text-yellow-600' };
    return { label: 'Stale', color: 'bg-gray-400', textColor: 'text-gray-500' };
  };

  const status = getLocationStatus(employee.recorded_at);
  const googleMapsUrl = `https://www.google.com/maps?q=${employee.latitude},${employee.longitude}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span>{employee.full_name}</span>
              <Badge variant="secondary" className={`ml-2 text-xs ${status.textColor}`}>
                {status.label}
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription>
            {employee.department || 'No department'} • {employee.position || 'No position'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Location Info */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Current Location</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Lat: {employee.latitude.toFixed(6)}, Lng: {employee.longitude.toFixed(6)}
                </p>
                {employee.accuracy && (
                  <p className="text-xs text-muted-foreground">
                    Accuracy: ±{Math.round(employee.accuracy)} meters
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(employee.recorded_at), 'MMM dd, yyyy hh:mm:ss a')}
                </p>
                <p className="text-xs text-muted-foreground">
                  ({formatDistanceToNow(new Date(employee.recorded_at), { addSuffix: true })})
                </p>
              </div>
            </div>

            {(employee.speed !== null || employee.heading !== null) && (
              <div className="flex items-start gap-3">
                <Navigation className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Movement</p>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {employee.speed !== null && (
                      <p>Speed: {(employee.speed * 3.6).toFixed(1)} km/h</p>
                    )}
                    {employee.heading !== null && (
                      <p>Heading: {Math.round(employee.heading)}°</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => window.open(googleMapsUrl, '_blank')}
            >
              <MapPin className="w-4 h-4 mr-2" />
              View on Google Maps
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LiveLocationMap({ companyId, isDeveloper, companies = [] }: LiveLocationMapProps) {
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(companyId);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLocation | null>(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

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

      const mapName = import.meta.env.VITE_AWS_LOCATION_MAP_NAME;

      if (!mapName) {
        setMapError('AWS Location Service map not configured. Please configure AWS credentials.');
        setIsMapLoading(false);
        return;
      }

      setIsMapLoading(false);
    } catch (err: any) {
      console.error('Map initialization error:', err);
      setMapError(err.message || 'Failed to load map');
      setIsMapLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeMap();
  }, [initializeMap]);

  const getLocationStatus = (recordedAt: string) => {
    const time = new Date(recordedAt);
    const minutesAgo = (Date.now() - time.getTime()) / 1000 / 60;
    
    if (minutesAgo <= 5) return { label: 'Active', color: 'bg-green-500' };
    if (minutesAgo <= 30) return { label: 'Recent', color: 'bg-yellow-500' };
    return { label: 'Stale', color: 'bg-gray-400' };
  };

  const handleEmployeeClick = (employee: EmployeeLocation) => {
    setSelectedEmployee(employee);
    setShowEmployeeDialog(true);
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
              <Select value={selectedCompany || 'all'} onValueChange={(val) => setSelectedCompany(val === 'all' ? null : val)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
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
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Map Container - Placeholder for AWS Location Service */}
        <div 
          ref={mapContainerRef}
          className="relative w-full h-[200px] sm:h-[250px] rounded-lg overflow-hidden bg-muted mb-4"
        >
          {isMapLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : mapError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <WifiOff className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-xs text-muted-foreground">{mapError}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure AWS Location Service to view the map
              </p>
            </div>
          ) : locations.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <MapPin className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No active locations</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-primary/5 to-primary/10">
              <Wifi className="w-10 h-10 text-primary mb-3" />
              <p className="text-sm font-medium">
                {locations.length} Employee{locations.length !== 1 ? 's' : ''} Tracked
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Click an employee below to view location details
              </p>
            </div>
          )}
        </div>

        {/* Employee List - Always show when loading or has data */}
        {isLoading && locations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading employees...</span>
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-6 border rounded-lg bg-muted/30">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No employees are currently being tracked</p>
            <p className="text-xs text-muted-foreground mt-1">
              Employees need to enable tracking consent in their profile settings
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Tracked Employees ({locations.length})
            </p>
            {locations.map((location) => {
              const status = getLocationStatus(location.recorded_at);
              return (
                <div
                  key={location.user_id}
                  onClick={() => handleEmployeeClick(location)}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${status.color}`} />
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
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
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {status.label}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(location.recorded_at), 'hh:mm a')}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Employee Location Detail Dialog */}
      <EmployeeLocationDialog
        employee={selectedEmployee}
        open={showEmployeeDialog}
        onOpenChange={setShowEmployeeDialog}
      />
    </Card>
  );
}