import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, MapPin, Plus, Pencil, Trash2, Loader2, Navigation } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

const GeofenceMapPicker = lazy(() => import('@/components/GeofenceMapPicker'));

interface GeofenceLocation {
  id: string;
  company_id: string;
  location_name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  aws_geofence_id: string | null;
  created_at: string;
}

export default function GeofenceLocations() {
  const { id: companyId } = useParams<{ id: string }>();
  const { isDeveloper } = useAuth();
  const { toast } = useToast();

  const [locations, setLocations] = useState<GeofenceLocation[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editLocation, setEditLocation] = useState<GeofenceLocation | null>(null);
  const [deleteLocation, setDeleteLocation] = useState<GeofenceLocation | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLat, setFormLat] = useState<number | null>(null);
  const [formLng, setFormLng] = useState<number | null>(null);
  const [formRadius, setFormRadius] = useState(100);
  const [formActive, setFormActive] = useState(true);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    const [{ data: company }, { data: locs }] = await Promise.all([
      supabase.from('companies').select('name').eq('id', companyId).single(),
      supabase.from('company_geofence_locations').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    ]);
    setCompanyName(company?.name || '');
    setLocations((locs as GeofenceLocation[]) || []);
    setIsLoading(false);
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setFormName('');
    setFormAddress('');
    setFormLat(null);
    setFormLng(null);
    setFormRadius(100);
    setFormActive(true);
  };

  const openEdit = (loc: GeofenceLocation) => {
    setEditLocation(loc);
    setFormName(loc.location_name);
    setFormAddress(loc.address || '');
    setFormLat(loc.latitude);
    setFormLng(loc.longitude);
    setFormRadius(loc.radius_meters);
    setFormActive(loc.is_active);
    setShowAddDialog(true);
  };

  const openAdd = () => {
    setEditLocation(null);
    resetForm();
    setShowAddDialog(true);
  };

  const handleLocationChange = (lat: number, lng: number, address?: string) => {
    setFormLat(lat);
    setFormLng(lng);
    if (address) setFormAddress(address);
  };

  const handleSave = async () => {
    if (!formName.trim() || formLat === null || formLng === null || !companyId) return;
    setIsSaving(true);

    const radius = formRadius || 100;
    const geofenceId = `${companyId}_${editLocation?.id || crypto.randomUUID()}`;

    try {
      // Create/update geofence in AWS
      const { error: awsError } = await supabase.functions.invoke('manage-geofence', {
        body: {
          action: 'put_geofence',
          geofenceId,
          latitude: formLat,
          longitude: formLng,
          radiusMeters: radius,
        },
      });
      if (awsError) console.warn('AWS geofence warning:', awsError);

      if (editLocation) {
        const { error } = await supabase.from('company_geofence_locations').update({
          location_name: formName.trim(),
          address: formAddress.trim() || null,
          latitude: formLat,
          longitude: formLng,
          radius_meters: isDeveloper ? radius : Math.min(radius, 500),
          is_active: formActive,
          aws_geofence_id: geofenceId,
        }).eq('id', editLocation.id);
        if (error) throw error;
        toast({ title: 'Updated', description: 'Geofence location updated' });
      } else {
        const { error } = await supabase.from('company_geofence_locations').insert({
          company_id: companyId,
          location_name: formName.trim(),
          address: formAddress.trim() || null,
          latitude: formLat,
          longitude: formLng,
          radius_meters: isDeveloper ? radius : Math.min(radius, 500),
          is_active: formActive,
          aws_geofence_id: geofenceId,
        });
        if (error) throw error;
        toast({ title: 'Added', description: 'Geofence location created' });
      }

      setShowAddDialog(false);
      resetForm();
      setEditLocation(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteLocation) return;
    setIsSaving(true);
    try {
      if (deleteLocation.aws_geofence_id) {
        await supabase.functions.invoke('manage-geofence', {
          body: { action: 'delete_geofence', geofenceIds: [deleteLocation.aws_geofence_id] },
        });
      }
      const { error } = await supabase.from('company_geofence_locations').delete().eq('id', deleteLocation.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Geofence location removed' });
      setDeleteLocation(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        <PageHeader
          title="Geofence Locations"
          description={`Manage attendance geofence zones for ${companyName}`}
          icon={<MapPin className="w-5 h-5 text-primary" />}
          backTo={isDeveloper ? `/developer/companies/${companyId}` : undefined}
          actions={
            <Button onClick={openAdd} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Location
            </Button>
          }
        />

        {locations.length === 0 ? (
          <EmptyState
            icon={<MapPin className="w-6 h-6 text-muted-foreground" />}
            title="No geofence locations"
            description="Add work locations to enable GPS-based attendance validation"
            action={
              <Button onClick={openAdd} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Location
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Location</TableHead>
                      <TableHead className="hidden sm:table-cell">Coordinates</TableHead>
                      <TableHead>Radius</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.map(loc => (
                      <TableRow key={loc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <MapPin className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{loc.location_name}</p>
                              {loc.address && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{loc.address}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs font-mono text-muted-foreground">
                          {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{loc.radius_meters}m</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={loc.is_active ? 'default' : 'secondary'} className="text-xs">
                            {loc.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(loc)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteLocation(loc)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Add/Edit Dialog with Map */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {editLocation ? 'Edit Location' : 'Add Geofence Location'}
            </DialogTitle>
            <DialogDescription>
              Search for a place or click on the map to set the geofence center
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Map Picker */}
            <Suspense
              fallback={
                <div className="h-[300px] rounded-lg bg-muted flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              }
            >
              <GeofenceMapPicker
                latitude={formLat}
                longitude={formLng}
                radius={formRadius}
                onLocationChange={handleLocationChange}
              />
            </Suspense>

            {/* Location name */}
            <div className="space-y-2">
              <Label>Location Name *</Label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Main Office, Warehouse B"
              />
            </div>

            {/* Address (auto-filled from search/reverse geocode) */}
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={formAddress}
                onChange={e => setFormAddress(e.target.value)}
                placeholder="Auto-filled from map selection"
              />
            </div>

            {/* Radius */}
            <div className="space-y-2">
              <Label>Radius (meters)</Label>
              <Input
                type="number"
                value={formRadius}
                onChange={e => setFormRadius(parseInt(e.target.value) || 100)}
                min={50}
                max={isDeveloper ? 10000 : 500}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                {isDeveloper ? 'Developer: max 10,000m' : 'Max 500m. Contact developer for larger radius.'}
              </p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formName.trim() || formLat === null || formLng === null}
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {editLocation ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLocation} onOpenChange={() => setDeleteLocation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Geofence Location?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deleteLocation?.location_name}</strong> and its geofence. Employees will no longer be validated against this location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
