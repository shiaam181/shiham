import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLiveLocations } from '@/hooks/useLiveLocations';
import { EmployeeLocationList } from './EmployeeLocationList';
import { EmployeeLocationDialog } from './EmployeeLocationDialog';
import { EmployeeMapView } from './EmployeeMapView';
import { EmployeeLocation } from '@/hooks/useLiveLocations';

interface CompanyTrackingDialogProps {
  company: { id: string; name: string; live_tracking_enabled: boolean } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrackingToggled: (companyId: string, enabled: boolean) => void;
}

export function CompanyTrackingDialog({ company, open, onOpenChange, onTrackingToggled }: CompanyTrackingDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLocation | null>(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);

  const { locations, isLoading: locationsLoading } = useLiveLocations(
    company?.live_tracking_enabled ? company?.id : undefined
  );

  if (!company) return null;

  const toggleTracking = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ live_tracking_enabled: enabled })
        .eq('id', company.id);

      if (error) throw error;

      onTrackingToggled(company.id, enabled);
      toast({
        title: enabled ? 'Tracking Enabled' : 'Tracking Disabled',
        description: `Live tracking ${enabled ? 'enabled' : 'disabled'} for ${company.name}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update tracking',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmployeeClick = (employee: EmployeeLocation) => {
    setSelectedEmployee(employee);
    setShowEmployeeDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {company.name}
            </DialogTitle>
            <DialogDescription>
              Manage live location tracking for this company
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  company.live_tracking_enabled ? 'bg-green-500/20' : 'bg-muted'
                }`}>
                  <MapPin className={`w-4 h-4 ${company.live_tracking_enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Live Tracking</Label>
                  <p className="text-xs text-muted-foreground">
                    {company.live_tracking_enabled ? 'Tracking is active' : 'Tracking is disabled'}
                  </p>
                </div>
              </div>
              <Switch
                checked={company.live_tracking_enabled}
                onCheckedChange={toggleTracking}
                disabled={isSaving}
              />
            </div>

            {/* Employee tracking content */}
            {company.live_tracking_enabled && (
              <div className="space-y-4">
                {/* Map */}
                <div className="rounded-lg border overflow-hidden" style={{ height: '250px' }}>
                  <EmployeeMapView
                    locations={locations}
                    onEmployeeClick={handleEmployeeClick}
                  />
                </div>

                {/* Employee list */}
                <EmployeeLocationList
                  locations={locations}
                  isLoading={locationsLoading}
                  onEmployeeClick={handleEmployeeClick}
                />
              </div>
            )}

            {!company.live_tracking_enabled && (
              <div className="text-center py-6 border rounded-lg bg-muted/30">
                <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Enable tracking to view employee locations
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EmployeeLocationDialog
        employee={selectedEmployee}
        open={showEmployeeDialog}
        onOpenChange={setShowEmployeeDialog}
      />
    </>
  );
}
