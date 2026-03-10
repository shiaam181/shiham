import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { DollarSign, Plus, Pencil, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_interval: string;
  currency: string;
  features: string[];
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
  badge_text: string | null;
}

const BILLING_INTERVALS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'per_user_monthly', label: 'Per User/Month' },
  { value: 'per_user_yearly', label: 'Per User/Year' },
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

const emptyPlan = {
  name: '',
  description: '',
  price: 0,
  billing_interval: 'monthly',
  currency: 'INR',
  features: [] as string[],
  is_popular: false,
  is_active: true,
  sort_order: 0,
  badge_text: '',
};

export default function DeveloperPricing() {
  const { isDeveloper } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const [featureInput, setFeatureInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setPlans(data.map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ ...emptyPlan, sort_order: plans.length });
    setFeatureInput('');
    setDialogOpen(true);
  };

  const openEdit = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      billing_interval: plan.billing_interval,
      currency: plan.currency,
      features: plan.features,
      is_popular: plan.is_popular,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
      badge_text: plan.badge_text || '',
    });
    setFeatureInput('');
    setDialogOpen(true);
  };

  const addFeature = () => {
    const trimmed = featureInput.trim();
    if (trimmed && !form.features.includes(trimmed)) {
      setForm({ ...form, features: [...form.features, trimmed] });
      setFeatureInput('');
    }
  };

  const removeFeature = (idx: number) => {
    setForm({ ...form, features: form.features.filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Plan name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      billing_interval: form.billing_interval,
      currency: form.currency,
      features: form.features,
      is_popular: form.is_popular,
      is_active: form.is_active,
      sort_order: form.sort_order,
      badge_text: form.badge_text.trim() || null,
    };

    let error;
    if (editingPlan) {
      ({ error } = await supabase.from('pricing_plans').update(payload).eq('id', editingPlan.id));
    } else {
      ({ error } = await supabase.from('pricing_plans').insert(payload));
    }

    if (error) {
      toast({ title: 'Failed to save plan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingPlan ? 'Plan updated' : 'Plan created' });
      setDialogOpen(false);
      fetchPlans();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pricing plan?')) return;
    const { error } = await supabase.from('pricing_plans').delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Plan deleted' });
      fetchPlans();
    }
  };

  const toggleActive = async (plan: PricingPlan) => {
    const { error } = await supabase
      .from('pricing_plans')
      .update({ is_active: !plan.is_active })
      .eq('id', plan.id);
    if (!error) fetchPlans();
  };

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Pricing Plans"
            description="Manage public pricing page content"
            icon={<DollarSign className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
          />
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add Plan
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <Card className="p-12 text-center">
            <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No pricing plans yet</p>
            <Button onClick={openCreate} size="sm">Create First Plan</Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => (
              <Card key={plan.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{plan.name}</h3>
                    <Badge variant={plan.is_active ? 'default' : 'secondary'} className="text-xs">
                      {plan.is_active ? 'Active' : 'Hidden'}
                    </Badge>
                    {plan.is_popular && <Badge variant="outline" className="text-xs">Popular</Badge>}
                    <Badge variant="outline" className="text-xs capitalize">
                      {plan.billing_interval.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.currency} {plan.price} · {plan.features.length} features
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => toggleActive(plan)} title={plan.is_active ? 'Hide' : 'Show'}>
                    {plan.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'New Pricing Plan'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Plan Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Starter" />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" rows={2} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Price</Label>
                  <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Order</Label>
                  <Input type="number" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Billing Interval</Label>
                <Select value={form.billing_interval} onValueChange={(v) => setForm({ ...form, billing_interval: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_INTERVALS.map((bi) => (
                      <SelectItem key={bi.value} value={bi.value}>{bi.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Badge Text</Label>
                <Input value={form.badge_text} onChange={(e) => setForm({ ...form, badge_text: e.target.value })} placeholder="e.g. Best Value" />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_popular} onCheckedChange={(v) => setForm({ ...form, is_popular: v })} />
                  <Label className="cursor-pointer">Popular</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label className="cursor-pointer">Active</Label>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <Label>Features</Label>
                <div className="flex gap-2">
                  <Input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    placeholder="Add a feature..."
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addFeature}>Add</Button>
                </div>
                {form.features.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {form.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                        <span className="flex-1">{f}</span>
                        <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingPlan ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AppLayout>
  );
}
