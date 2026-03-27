import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Settings2, Check, X, Minus, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanInfo { id: string; name: string; sort_order: number; }
interface Feature { name: string; category: string; sort_order: number; }
interface FeatureConfig { plan_id: string; feature_name: string; status: string; }

type Status = 'yes' | 'no' | 'limited';
const STATUS_CYCLE: Status[] = ['yes', 'limited', 'no'];

export default function DeveloperPlanFeatures() {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [configs, setConfigs] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const key = (planId: string, feat: string) => `${planId}::${feat}`;

  useEffect(() => {
    const load = async () => {
      const [plansRes, featRes, configRes] = await Promise.all([
        supabase.from('pricing_plans').select('id, name, sort_order').order('sort_order'),
        supabase.from('platform_features').select('name, category, sort_order').order('sort_order'),
        supabase.from('plan_feature_config').select('plan_id, feature_name, status'),
      ]);

      if (plansRes.data) setPlans(plansRes.data);
      if (featRes.data) setFeatures(featRes.data);

      const map: Record<string, Status> = {};
      if (configRes.data) {
        configRes.data.forEach((c: any) => { map[key(c.plan_id, c.feature_name)] = c.status as Status; });
      }
      setConfigs(map);
      setLoading(false);
    };
    load();
  }, []);

  const toggle = (planId: string, feat: string) => {
    const k = key(planId, feat);
    const current = configs[k] || 'no';
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setConfigs(prev => ({ ...prev, [k]: next }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    // Build upsert rows
    const rows: Array<{ plan_id: string; feature_name: string; status: string; sort_order: number }> = [];
    for (const plan of plans) {
      for (const feat of features) {
        const k = key(plan.id, feat.name);
        rows.push({
          plan_id: plan.id,
          feature_name: feat.name,
          status: configs[k] || 'no',
          sort_order: feat.sort_order,
        });
      }
    }

    const { error } = await supabase
      .from('plan_feature_config')
      .upsert(rows, { onConflict: 'plan_id,feature_name' });

    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Feature configuration saved!' });
      setDirty(false);
    }
    setSaving(false);
  };

  const categories = [...new Set(features.map(f => f.category))];

  const StatusIcon = ({ status }: { status: Status }) => {
    if (status === 'yes') return <Check className="w-5 h-5 text-emerald-500" />;
    if (status === 'limited') return <Minus className="w-4 h-4 text-amber-500" />;
    return <X className="w-5 h-5 text-destructive/60" />;
  };

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <PageHeader
            title="Plan Feature Config"
            description="Configure which features are included in each pricing plan"
            icon={<Settings2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
          />
          <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="gap-1.5 shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Create pricing plans first in the Pricing Plans page.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden border-border/60">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-semibold text-foreground min-w-[220px] sticky left-0 bg-muted/40 z-10">
                      Modules & Features
                    </th>
                    {plans.map(plan => (
                      <th key={plan.id} className="text-center py-3 px-4 min-w-[120px]">
                        <span className="font-semibold text-foreground">{plan.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <>
                      <tr key={cat} className="bg-muted/20">
                        <td colSpan={plans.length + 1} className="py-2 px-4">
                          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider">{cat}</Badge>
                        </td>
                      </tr>
                      {features.filter(f => f.category === cat).map((feat, fi) => (
                        <tr key={feat.name} className={cn("border-b border-border/20 hover:bg-muted/10 transition-colors", fi % 2 === 0 && "bg-card")}>
                          <td className="py-3 px-4 font-medium text-foreground sticky left-0 bg-inherit z-10">
                            {feat.name}
                          </td>
                          {plans.map(plan => {
                            const k = key(plan.id, feat.name);
                            const status = configs[k] || 'no';
                            return (
                              <td key={plan.id} className="text-center py-3 px-4">
                                <button
                                  onClick={() => toggle(plan.id, feat.name)}
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted/60 transition-colors"
                                  title={`Click to cycle: ${status} → ${STATUS_CYCLE[(STATUS_CYCLE.indexOf(status as Status) + 1) % 3]}`}
                                >
                                  <StatusIcon status={status as Status} />
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Included</span>
          <span className="flex items-center gap-1.5"><Minus className="w-4 h-4 text-amber-500" /> Limited</span>
          <span className="flex items-center gap-1.5"><X className="w-4 h-4 text-destructive/60" /> Not included</span>
          <span className="ml-auto">Click any cell to cycle status</span>
        </div>
      </main>
    </AppLayout>
  );
}
