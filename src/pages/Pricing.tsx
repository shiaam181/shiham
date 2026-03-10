import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_interval: string;
  currency: string;
  features: string[];
  is_popular: boolean;
  badge_text: string | null;
  sort_order: number;
}

const INTERVAL_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
  weekly: 'Weekly',
  daily: 'Daily',
  quarterly: 'Quarterly',
  'per_user_monthly': 'Per User/Month',
  'per_user_yearly': 'Per User/Year',
};

export default function Pricing() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInterval, setActiveInterval] = useState('monthly');
  const [availableIntervals, setAvailableIntervals] = useState<string[]>([]);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        const parsed = data.map((p: any) => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : [],
        }));
        setPlans(parsed);

        const intervals = [...new Set(parsed.map((p: PricingPlan) => p.billing_interval))];
        setAvailableIntervals(intervals);
        if (intervals.length > 0 && !intervals.includes(activeInterval)) {
          setActiveInterval(intervals[0]);
        }
      }
      setLoading(false);
    };
    fetchPlans();
  }, []);

  const filteredPlans = plans.filter((p) => p.billing_interval === activeInterval);

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return 'Free';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button size="sm" onClick={() => navigate('/auth')}>
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="py-16 sm:py-24 text-center px-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-primary text-sm font-medium">Pricing</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Choose the plan that works best for your team. No hidden fees.
        </p>

        {/* Interval Tabs */}
        {availableIntervals.length > 1 && (
          <div className="mt-10 inline-flex items-center gap-1 p-1 rounded-xl bg-muted border border-border/60">
            {availableIntervals.map((interval) => (
              <button
                key={interval}
                onClick={() => setActiveInterval(interval)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeInterval === interval
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {INTERVAL_LABELS[interval] || interval}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="container mx-auto px-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredPlans.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No pricing plans available yet.</p>
        ) : (
          <div className={cn(
            'grid gap-6 max-w-5xl mx-auto',
            filteredPlans.length === 1 ? 'grid-cols-1 max-w-sm' :
            filteredPlans.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' :
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          )}>
            {filteredPlans.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col p-6 sm:p-8 rounded-2xl transition-all',
                  plan.is_popular
                    ? 'border-primary/50 shadow-lg shadow-primary/10 scale-[1.02]'
                    : 'border-border/60 hover:border-border'
                )}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-sm">
                      {plan.badge_text || 'Most Popular'}
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold tracking-tight">
                    {formatPrice(plan.price, plan.currency)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground text-sm ml-1">
                      /{INTERVAL_LABELS[plan.billing_interval]?.toLowerCase() || plan.billing_interval}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.is_popular ? 'default' : 'outline'}
                  onClick={() => navigate('/auth')}
                >
                  Get Started
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto py-6 px-4 border-t border-border/40 bg-card">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>© 2026 AttendanceHub</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
