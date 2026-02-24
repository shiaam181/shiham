import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Receipt, Plus, Loader2, Save, Pencil, Trash2 } from 'lucide-react';

interface LeavePolicy {
  id: string;
  company_id: string | null;
  leave_type: string;
  annual_quota: number;
  monthly_accrual: number;
  carry_forward_limit: number;
  encashment_allowed: boolean;
  is_paid: boolean;
  is_active: boolean;
}

const DEFAULT_TYPES = [
  { type: 'casual', label: 'Casual Leave (CL)' },
  { type: 'sick', label: 'Sick Leave (SL)' },
  { type: 'earned', label: 'Earned Leave (EL)' },
  { type: 'unpaid', label: 'Loss of Pay (LOP)' },
  { type: 'maternity', label: 'Maternity Leave' },
  { type: 'paternity', label: 'Paternity Leave' },
];

export default function LeavePolicies() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<LeavePolicy | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    leave_type: '',
    annual_quota: 12,
    monthly_accrual: 1,
    carry_forward_limit: 0,
    encashment_allowed: false,
    is_paid: true,
  });

  useEffect(() => { fetchPolicies(); }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    const { data } = await supabase.from('leave_policies').select('*').order('leave_type');
    setPolicies((data as LeavePolicy[]) || []);
    setLoading(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ leave_type: '', annual_quota: 12, monthly_accrual: 1, carry_forward_limit: 0, encashment_allowed: false, is_paid: true });
    setShowDialog(true);
  };

  const openEdit = (p: LeavePolicy) => {
    setEditing(p);
    setForm({
      leave_type: p.leave_type,
      annual_quota: Number(p.annual_quota),
      monthly_accrual: Number(p.monthly_accrual),
      carry_forward_limit: Number(p.carry_forward_limit),
      encashment_allowed: p.encashment_allowed,
      is_paid: p.is_paid,
    });
    setShowDialog(true);
  };

  const savePolicy = async () => {
    if (!form.leave_type) {
      toast({ title: 'Error', description: 'Enter leave type', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      company_id: profile?.company_id || null,
      leave_type: form.leave_type,
      annual_quota: form.annual_quota,
      monthly_accrual: form.monthly_accrual,
      carry_forward_limit: form.carry_forward_limit,
      encashment_allowed: form.encashment_allowed,
      is_paid: form.is_paid,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('leave_policies').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('leave_policies').insert(payload));
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Leave policy updated' });
      setShowDialog(false);
      fetchPolicies();
    }
    setSaving(false);
  };

  const deletePolicy = async (id: string) => {
    const { error } = await supabase.from('leave_policies').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted' });
      fetchPolicies();
    }
  };

  const getTypeLabel = (type: string) => DEFAULT_TYPES.find(t => t.type === type)?.label || type;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="w-6 h-6 text-primary" />
              Leave Policies
            </h1>
            <p className="text-sm text-muted-foreground">Configure leave types, quotas, and accrual rules</p>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Policy
          </Button>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Annual Quota</TableHead>
                <TableHead>Monthly Accrual</TableHead>
                <TableHead>Carry Forward</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Encashment</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No leave policies configured. Add policies to get started.
                  </TableCell>
                </TableRow>
              ) : (
                policies.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{getTypeLabel(p.leave_type)}</TableCell>
                    <TableCell>{p.annual_quota} days</TableCell>
                    <TableCell>{p.monthly_accrual} days/mo</TableCell>
                    <TableCell>{p.carry_forward_limit > 0 ? `${p.carry_forward_limit} days` : 'None'}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_paid ? 'default' : 'secondary'}>{p.is_paid ? 'Paid' : 'Unpaid'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.encashment_allowed ? 'default' : 'secondary'}>{p.encashment_allowed ? 'Yes' : 'No'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePolicy(p.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Add'} Leave Policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Input
                value={form.leave_type}
                onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
                placeholder="e.g. casual, sick, earned"
                list="leave-types"
              />
              <datalist id="leave-types">
                {DEFAULT_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Annual Quota (days)</Label>
                <Input type="number" value={form.annual_quota} onChange={e => setForm(f => ({ ...f, annual_quota: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Accrual (days)</Label>
                <Input type="number" step="0.5" value={form.monthly_accrual} onChange={e => setForm(f => ({ ...f, monthly_accrual: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Carry Forward Limit</Label>
                <Input type="number" value={form.carry_forward_limit} onChange={e => setForm(f => ({ ...f, carry_forward_limit: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_paid} onCheckedChange={v => setForm(f => ({ ...f, is_paid: v }))} />
                <Label>Paid Leave</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.encashment_allowed} onCheckedChange={v => setForm(f => ({ ...f, encashment_allowed: v }))} />
                <Label>Encashment</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={savePolicy} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
