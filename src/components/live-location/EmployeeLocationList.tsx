import { Badge } from '@/components/ui/badge';
import { ChevronRight, User, Loader2, Users } from 'lucide-react';
import { EmployeeLocation } from '@/hooks/useLiveLocations';
import { format } from 'date-fns';

interface EmployeeLocationListProps {
  locations: EmployeeLocation[];
  isLoading: boolean;
  isDeveloper?: boolean;
  onEmployeeClick: (employee: EmployeeLocation) => void;
}

function getLocationStatus(recordedAt: string) {
  const time = new Date(recordedAt);
  const minutesAgo = (Date.now() - time.getTime()) / 1000 / 60;

  if (minutesAgo <= 5) return { label: 'Active', color: 'bg-green-500' };
  if (minutesAgo <= 30) return { label: 'Recent', color: 'bg-yellow-500' };
  return { label: 'Stale', color: 'bg-gray-400' };
}

export function EmployeeLocationList({ locations, isLoading, isDeveloper, onEmployeeClick }: EmployeeLocationListProps) {
  if (isLoading && locations.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading employees...</span>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="text-center py-6 border rounded-lg bg-muted/30">
        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No employees are currently being tracked</p>
        <p className="text-xs text-muted-foreground mt-1">
          Employees need to enable tracking consent in their profile settings
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Tracked Employees ({locations.length})
      </p>
      {locations.map((location) => {
        const status = getLocationStatus(location.recorded_at);
        return (
          <div
            key={location.user_id}
            onClick={() => onEmployeeClick(location)}
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
  );
}
