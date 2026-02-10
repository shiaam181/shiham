import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Navigation, User } from 'lucide-react';
import { EmployeeLocation } from '@/hooks/useLiveLocations';
import { format, formatDistanceToNow } from 'date-fns';

interface EmployeeLocationDialogProps {
  employee: EmployeeLocation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getLocationStatus(recordedAt: string) {
  const time = new Date(recordedAt);
  const minutesAgo = (Date.now() - time.getTime()) / 1000 / 60;

  if (minutesAgo <= 5) return { label: 'Active', color: 'bg-green-500', textColor: 'text-green-600' };
  if (minutesAgo <= 30) return { label: 'Recent', color: 'bg-yellow-500', textColor: 'text-yellow-600' };
  return { label: 'Stale', color: 'bg-gray-400', textColor: 'text-gray-500' };
}

export function EmployeeLocationDialog({ employee, open, onOpenChange }: EmployeeLocationDialogProps) {
  if (!employee) return null;

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
