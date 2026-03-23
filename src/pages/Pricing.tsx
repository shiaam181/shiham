import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowLeft, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

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
  monthly: 'month',
  yearly: 'year',
  weekly: 'week',
  daily: 'day',
  quarterly: 'quarter',
  per_user_monthly: 'user/month',
  per_user_yearly: 'user/year',
};

// All modules/features to compare across plans
const ALL_MODULES = [
  'Leave Management',
  'Attendance Management',
  'Payroll Management',
  'Face Verification',
  'Geofencing & GPS',
  'Employee Self Service',
  'Performance Management',
  'Employee Onboarding',
  'Document Management',
  'Reports & Analytics',
  'Smart Automation',
  'Statutory Compliance',
  'Employee Engagement',
  'Employee Portal (Web & Mobile)',
  'API Access',
  'Priority Support',
];

export default function Pricing() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInterval, setActiveInterval] = useState('monthly');
  const [availableIntervals, setAvailableIntervals] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'plans' | 'comparison' | 'faq'>('plans');

  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        const parsed = data.map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] }));
        setPlans(parsed);
        const intervals = [...new Set(parsed.map((p: PricingPlan) => p.billing_interval))];
        setAvailableIntervals(intervals);
        if (intervals.length > 0 && !intervals.includes(activeInterval)) setActiveInterval(intervals[0]);
      }
      setLoading(false);
    };
    fetchPlans();
  }, []);

  const filteredPlans = plans.filter((p) => p.billing_interval === activeInterval);

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return '0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0 }).format(price);
  };

  const hasFeature = (plan: PricingPlan, module: string): 'yes' | 'limited' | 'no' => {
    const lower = module.toLowerCase();
    const match = plan.features.find(f => f.toLowerCase().includes(lower.split(' ')[0]));
    if (match) {
      if (match.toLowerCase().includes('limited')) return 'limited';
      return 'yes';
    }
    // Free plans get limited access by default for basic modules
    if (plan.price === 0) {
      const basicModules = ['leave', 'attendance', 'employee portal', 'employee self'];
      return basicModules.some(b => lower.includes(b)) ? 'limited' : 'no';
    }
    // Paid plans get most features
    return 'yes';
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/95 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">Z</span>
              </div>
              <span className="font-display font-bold text-foreground hidden sm:inline">Zentrek</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>Login</Button>
            <Button size="sm" onClick={() => navigate('/auth')} className="gap-1.5">
              Start Free Trial
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="py-12 sm:py-20 text-center px-4">
        <ScrollReveal>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-primary text-sm font-medium">Pricing</span>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight mb-4">
            Simple, Transparent Pricing
          </h1>
        </ScrollReveal>
        <ScrollReveal delay={200}>
          <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto mb-8">
            Choose the plan that works best for your team. No hidden fees.
          </p>
        </ScrollReveal>

        {/* Interval Toggle */}
        {availableIntervals.length > 1 && (
          <ScrollReveal delay={250}>
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted border border-border/60">
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
                  {interval.charAt(0).toUpperCase() + interval.slice(1).replace('_', ' ')}
                </button>
              ))}
            </div>
          </ScrollReveal>
        )}
      </div>

      {/* Bottom Tabs - greytHR style */}
      <div className="sticky bottom-0 sm:relative sm:bottom-auto z-20 bg-card border-t sm:border-t-0 border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-1 p-1 sm:gap-2">
            {[
              { key: 'plans', label: 'Plans' },
              { key: 'comparison', label: 'Feature Comparison' },
              { key: 'faq', label: 'FAQs' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium rounded-lg transition-all",
                  activeTab === tab.key
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 pb-24 sm:pb-20 pt-6 sm:pt-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Plans Tab ── */}
            {activeTab === 'plans' && (
              filteredPlans.length === 0 ? (
                <p className="text-center text-muted-foreground py-20">No pricing plans available yet.</p>
              ) : (
                <div className={cn(
                  'grid gap-5 sm:gap-6 max-w-5xl mx-auto',
                  filteredPlans.length === 1 ? 'grid-cols-1 max-w-sm' :
                  filteredPlans.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' :
                  filteredPlans.length <= 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                  'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                )}>
                  {filteredPlans.map((plan, i) => (
                    <ScrollReveal key={plan.id} delay={i * 80}>
                      <div
                        className={cn(
                          'relative flex flex-col p-6 sm:p-7 rounded-2xl border transition-all h-full',
                          plan.is_popular
                            ? 'border-primary/50 shadow-lg shadow-primary/10 bg-card'
                            : 'border-border/60 bg-card hover:border-border hover:shadow-md'
                        )}
                      >
                        {plan.is_popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge className="bg-primary text-primary-foreground shadow-sm">
                              {plan.badge_text || 'Most Popular'}
                            </Badge>
                          </div>
                        )}

                        <div className="mb-5">
                          <h3 className="text-lg font-display font-bold mb-1">{plan.name}</h3>
                          {plan.description && (
                            <p className="text-xs text-muted-foreground">{plan.description}</p>
                          )}
                        </div>

                        <div className="mb-5">
                          <span className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
                            {formatPrice(plan.price, plan.currency)}
                          </span>
                          {plan.price > 0 && (
                            <span className="text-muted-foreground text-sm ml-1">
                              /{INTERVAL_LABELS[plan.billing_interval] || plan.billing_interval}
                            </span>
                          )}
                        </div>

                        <ul className="space-y-2.5 mb-6 flex-1">
                          {plan.features.map((feature, fi) => (
                            <li key={fi} className="flex items-start gap-2.5 text-sm">
                              <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <Button
                          className="w-full"
                          variant={plan.is_popular ? 'default' : 'outline'}
                          onClick={() => navigate('/auth')}
                        >
                          Start Free Trial
                        </Button>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>
              )
            )}

            {/* ── Comparison Tab ── */}
            {activeTab === 'comparison' && (
              <div className="max-w-5xl mx-auto">
                <div className="responsive-table-wrapper">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left py-3 px-4 font-display font-bold text-base text-foreground min-w-[200px]">
                          Modules and Features
                        </th>
                        {filteredPlans.map(plan => (
                          <th key={plan.id} className="text-center py-3 px-4 min-w-[130px]">
                            <div className="font-display font-bold text-base">{plan.name}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {plan.price === 0 ? 'Free' : (
                                <>
                                  <span className="text-foreground font-semibold">{formatPrice(plan.price, plan.currency)}</span>
                                  <span className="text-muted-foreground">/{INTERVAL_LABELS[plan.billing_interval]?.split('/')[0] || plan.billing_interval}</span>
                                </>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_MODULES.map((mod, i) => (
                        <tr key={mod} className={cn("border-b border-border/30", i % 2 === 0 && "bg-muted/20")}>
                          <td className="py-3 px-4 font-medium text-foreground">{mod}</td>
                          {filteredPlans.map(plan => {
                            const status = hasFeature(plan, mod);
                            return (
                              <td key={plan.id} className="text-center py-3 px-4">
                                {status === 'yes' ? (
                                  <Check className="w-5 h-5 text-success mx-auto" />
                                ) : status === 'limited' ? (
                                  <span className="text-xs font-medium text-muted-foreground">Limited</span>
                                ) : (
                                  <X className="w-5 h-5 text-destructive/60 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── FAQ Tab ── */}
            {activeTab === 'faq' && (
              <div className="max-w-2xl mx-auto space-y-4">
                {[
                  { q: 'Is there a free trial?', a: 'Yes! You can start with our free trial that includes basic features for up to 50 employees.' },
                  { q: 'Can I change plans later?', a: 'Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect immediately.' },
                  { q: 'Is there a setup fee?', a: 'No, there are no setup fees. You can get started in minutes with zero upfront cost.' },
                  { q: 'What payment methods are accepted?', a: 'We accept all major credit/debit cards, UPI, and bank transfers for annual plans.' },
                  { q: 'Do you offer custom enterprise plans?', a: 'Yes, for large organizations with 500+ employees, we offer custom pricing with dedicated support.' },
                ].map((faq, i) => (
                  <ScrollReveal key={i} delay={i * 60}>
                    <div className="p-5 rounded-xl border border-border/50 bg-card hover:border-primary/20 transition-colors">
                      <h3 className="font-display font-semibold text-foreground mb-2">{faq.q}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto py-6 px-4 border-t border-border/40 bg-card">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>© 2026 Zentrek</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
