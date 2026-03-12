import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, BarChart3, Gauge, Activity } from 'lucide-react';

export default function KPITracking() {
  const { user, profile, isAdmin, isHR, isDeveloper } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isHR || isDeveloper;
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [kpiForm, setKpiForm] = useState({ name: '', description: '', category: 'general', measurement_type: 'numeric', target_value: '', unit: '' });

  const { data: kpiDefs = [], isLoading: defsLoading } = useQuery({
    queryKey: ['kpi-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kpi_definitions').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: kpiScores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ['kpi-scores', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('kpi_scores').select('*').order('scored_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createKPI = useMutation({
    mutationFn: async () => {
      if (!user || !profile?.company_id) throw new Error('Missing context');
      const { error } = await supabase.from('kpi_definitions').insert({
        company_id: profile.company_id,
        name: kpiForm.name,
        description: kpiForm.description || null,
        category: kpiForm.category,
        measurement_type: kpiForm.measurement_type,
        target_value: kpiForm.target_value ? Number(kpiForm.target_value) : null,
        unit: kpiForm.unit || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-definitions'] });
      setKpiDialogOpen(false);
      setKpiForm({ name: '', description: '', category: 'general', measurement_type: 'numeric', target_value: '', unit: '' });
      toast.success('KPI created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const myScores = kpiScores.filter(s => s.user_id === user?.id);
  const avgScore = myScores.length > 0 ? (myScores.reduce((s, k) => s + (k.score || 0), 0) / myScores.length).toFixed(1) : '-';

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <PageHeader title="KPI Tracking" description="Key Performance Indicators and metrics" actions={
          canManage ? <Button onClick={() => setKpiDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Define KPI</Button> : undefined
        } />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><BarChart3 className="w-8 h-8 text-primary" /><div><p className="text-2xl font-bold">{kpiDefs.length}</p><p className="text-sm text-muted-foreground">Active KPIs</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Activity className="w-8 h-8 text-blue-500" /><div><p className="text-2xl font-bold">{myScores.length}</p><p className="text-sm text-muted-foreground">My Scores</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Gauge className="w-8 h-8 text-green-500" /><div><p className="text-2xl font-bold">{avgScore}</p><p className="text-sm text-muted-foreground">Avg Score</p></div></div></CardContent></Card>
        </div>

        {/* KPI Definitions */}
        <Card>
          <CardHeader><CardTitle className="text-lg">KPI Definitions</CardTitle></CardHeader>
          <CardContent>
            {defsLoading ? (
              <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
            ) : kpiDefs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{canManage ? 'No KPIs defined yet. Create your first KPI.' : 'No KPIs have been defined for your organization yet.'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>KPI Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpiDefs.map(kpi => (
                    <TableRow key={kpi.id}>
                      <TableCell>
                        <div><p className="font-medium">{kpi.name}</p>{kpi.description && <p className="text-xs text-muted-foreground">{kpi.description}</p>}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{kpi.category}</Badge></TableCell>
                      <TableCell>{kpi.target_value ? `${kpi.target_value} ${kpi.unit || ''}` : '-'}</TableCell>
                      <TableCell><Badge variant="secondary">{kpi.measurement_type}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* My KPI Scores */}
        {myScores.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">My KPI Scores</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myScores.map(score => {
                  const kpi = kpiDefs.find(k => k.id === score.kpi_id);
                  const pct = score.target_value ? Math.min(100, Math.round((score.score / score.target_value) * 100)) : 0;
                  return (
                    <div key={score.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-medium text-sm">{kpi?.name || 'Unknown KPI'}</p>
                        <span className="text-sm font-bold">{score.score}{kpi?.unit ? ` ${kpi.unit}` : ''}</span>
                      </div>
                      {score.target_value && <Progress value={pct} className="h-2" />}
                      {score.notes && <p className="text-xs text-muted-foreground mt-1">{score.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create KPI Dialog */}
        <Dialog open={kpiDialogOpen} onOpenChange={setKpiDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Define New KPI</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>KPI Name</Label><Input value={kpiForm.name} onChange={e => setKpiForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Customer Satisfaction Score" /></div>
              <div><Label>Description</Label><Textarea value={kpiForm.description} onChange={e => setKpiForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Category</Label>
                  <Select value={kpiForm.category} onValueChange={v => setKpiForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="productivity">Productivity</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Measurement Type</Label>
                  <Select value={kpiForm.measurement_type} onValueChange={v => setKpiForm(p => ({ ...p, measurement_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">Numeric</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="currency">Currency</SelectItem>
                      <SelectItem value="boolean">Yes/No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Target Value</Label><Input type="number" value={kpiForm.target_value} onChange={e => setKpiForm(p => ({ ...p, target_value: e.target.value }))} /></div>
                <div><Label>Unit</Label><Input value={kpiForm.unit} onChange={e => setKpiForm(p => ({ ...p, unit: e.target.value }))} placeholder="e.g. %, ₹, pts" /></div>
              </div>
              <Button className="w-full" onClick={() => createKPI.mutate()} disabled={!kpiForm.name || createKPI.isPending}>
                {createKPI.isPending ? 'Creating...' : 'Create KPI'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
