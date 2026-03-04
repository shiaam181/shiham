import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { ArrowLeft, MapPin, Plus, Pencil, Trash2, Loader2, Navigation, Building2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

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
  const navigate = useNavigate();
  const { isDeveloper, isAdmin, isOwner } = useAuth();
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
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formRadius, setFormRadius] = useState('100');
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
    setFormLat('');
    setFormLng('');
    setFormRadius('100');
    setFormActive(true);
  };

  const openEdit = (loc: GeofenceLocation) => {
    setEditLocation(loc);
    setFormName(loc.location_name);
    setFormAddress(loc.address || '');
    setFormLat(String(loc.latitude));
    setFormLng(String(loc.longitude));
    setFormRadius(String(loc.radius_meters));
    setFormActive(loc.is_active);
    setShowAddDialog(true);
  };

  const openAdd = () => {
    setEditLocation(null);
    resetForm();
    setShowAddDialog(true);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Error', description: 'Geolocation not supported', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLat(String(pos.coords.latitude));
        setFormLng(String(pos.coords.longitude));
        toast({ title: 'Location captured', description: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` });
      },
      (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    if (!formName.trim() || !formLat || !formLng || !companyId) return;
    setIsSaving(true);

    const lat = parseFloat(formLat);
    const lng = parseFloat(formLng);
    const radius = parseInt(formRadius) || 100;
    const geofenceId = `${companyId}_${editLocation?.id || crypto.randomUUID()}`;

    try {
      // Create/update geofence in AWS via edge function
      const { data: awsResult, error: awsError } = await supabase.functions.invoke('manage-geofence', {
        body: {
          action: 'put_geofence',
          geofenceId,
          latitude: lat,
          longitude: lng,
          radiusMeters: radius,
        },
      });

      if (awsError) {
        console.warn('AWS geofence creation warning:', awsError);
        // Continue with DB save even if AWS fails - will retry later
      }

      if (editLocation) {
        // Update
        const { error } = await supabase.from('company_geofence_locations').update({
          location_name: formName.trim(),
          address: formAddress.trim() || null,
          latitude: lat,
          longitude: lng,
          radius_meters: isDeveloper ? radius : Math.min(radius, 500),
          is_active: formActive,
          aws_geofence_id: geofenceId,
        }).eq('id', editLocation.id);

        if (error) throw error;
        toast({ title: 'Updated', description: 'Geofence location updated' });
      } else {
        // Insert
        const { error } = await supabase.from('company_geofence_locations').insert({
          company_id: companyId,
          location_name: formName.trim(),
          address: formAddress.trim() || null,
          latitude: lat,
          longitude: lng,
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
      // Delete from AWS
      if (deleteLocation.aws_geofence_id) {
        await supabase.functions.invoke('manage-geofence', {
          body: {
            action: 'delete_geofence',
            geofenceIds: [deleteLocation.aws_geofence_id],
          },
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
          backPath={isDeveloper ? `/developer/companies/${companyId}` : undefined}
          actions={
            <Button onClick={openAdd} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Location
            </Button>
          }
        />

        {locations.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No geofence locations"
            description="Add work locations to enable GPS-based attendance validation"
            actionLabel="Add Location"
            onAction={openAdd}
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

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {editLocation ? 'Edit Location' : 'Add Geofence Location'}
            </DialogTitle>
            <DialogDescription>
              Define a work location with GPS coordinates and radius
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Location Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Main Office" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Street address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Latitude *</Label>
                <Input type="number" step="any" value={formLat} onChange={e => setFormLat(e.target.value)} placeholder="e.g. 12.9716" />
              </div>
              <div className="space-y-2">
                <Label>Longitude *</Label>
                <Input type="number" step="any" value={formLng} onChange={e => setFormLng(e.target.value)} placeholder="e.g. 77.5946" />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={useCurrentLocation} className="w-full">
              <Navigation className="w-4 h-4 mr-1" />
              Use Current Location
            </Button>
            <div className="space-y-2">
              <Label>Radius (meters)</Label>
              <Input
                type="number"
                value={formRadius}
                onChange={e => setFormRadius(e.target.value)}
                min="50"
                max={isDeveloper ? "10000" : "500"}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                {isDeveloper ? 'Developer: max 10,000m' : 'Max 500m. Contact developer for larger radius.'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !formName.trim() || !formLat || !formLng}>
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
              This will remove <strong>{deleteLocation?.location_name}</strong> and its AWS geofence. Employees will no longer be validated against this location.
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
