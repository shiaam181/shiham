import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, RefreshCw, Users, Clock, AlertTriangle } from 'lucide-react';
import { useLiveLocations, EmployeeLocation } from '@/hooks/useLiveLocations';
import { formatDistanceToNow } from 'date-fns';
import { EmployeeMapView } from '@/components/live-location/EmployeeMapView';
import { EmployeeLocationList } from '@/components/live-location/EmployeeLocationList';
import { EmployeeLocationDialog } from '@/components/live-location/EmployeeLocationDialog';

interface LiveLocationMapProps {
  companyId?: string;
  isDeveloper?: boolean;
  companies?: Array<{ id: string; name: string }>;
}

export function LiveLocationMap({ companyId, isDeveloper, companies = [] }: LiveLocationMapProps) {
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(companyId);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLocation | null>(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);

  const { locations, isLoading, error, lastFetch, refetch } = useLiveLocations(
    selectedCompany,
    30000
  );

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
              <Select value={selectedCompany || 'all'} onValueChange={(val) => setSelectedCompany(val === 'all' ? undefined : val)}>
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
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Interactive Map */}
        <EmployeeMapView
          locations={locations}
          isLoading={isLoading}
          onEmployeeClick={handleEmployeeClick}
        />

        {/* Employee List */}
        <EmployeeLocationList
          locations={locations}
          isLoading={isLoading}
          isDeveloper={isDeveloper}
          onEmployeeClick={handleEmployeeClick}
        />
      </CardContent>

      <EmployeeLocationDialog
        employee={selectedEmployee}
        open={showEmployeeDialog}
        onOpenChange={setShowEmployeeDialog}
      />
    </Card>
  );
}
