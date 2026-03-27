import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowLeft, Sparkles, ArrowRight, Minus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { GoldenParticles } from '@/components/landing/GoldenParticles';

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

interface FeatureConfig {
  plan_id: string;
  feature_name: string;
  status: string;
}

interface PlatformFeature {
  name: string;
  category: string;
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

export default function Pricing() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [featureConfigs, setFeatureConfigs] = useState<FeatureConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInterval, setActiveInterval] = useState('monthly');
  const [availableIntervals, setAvailableIntervals] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'plans' | 'comparison' | 'faq'>('plans');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAll = async () => {
      const [plansRes, featRes, configRes] = await Promise.all([
        supabase.from('pricing_plans').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('platform_features').select('name, category, sort_order').order('sort_order'),
        supabase.from('plan_feature_config').select('plan_id, feature_name, status'),
      ]);

      if (plansRes.data) {
        const parsed = plansRes.data.map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] }));
        setPlans(parsed);
        const intervals = [...new Set(parsed.map((p: PricingPlan) => p.billing_interval))];
        setAvailableIntervals(intervals);
        if (intervals.length > 0 && !intervals.includes(activeInterval)) setActiveInterval(intervals[0]);
      }
      if (featRes.data) setFeatures(featRes.data);
      if (configRes.data) setFeatureConfigs(configRes.data as FeatureConfig[]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const filteredPlans = plans.filter((p) => p.billing_interval === activeInterval);

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return '0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0 }).format(price);
  };

  const getFeatureStatus = (planId: string, featureName: string): string => {
    const config = featureConfigs.find(c => c.plan_id === planId && c.feature_name === featureName);
    return config?.status || 'no';
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const categories = [...new Set(features.map(f => f.category))];

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

      {/* Hero with particles */}
      <div className="relative py-12 sm:py-20 text-center px-4 overflow-hidden">
        <GoldenParticles />
        <div className="relative z-10">
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
            <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto mb-4">
              Choose the plan that works best for your team. No hidden fees.
            </p>
            <p className="text-muted-foreground/70 text-sm max-w-sm mx-auto mb-8">
              All plans include 50 employees. Additional employees available as add-ons.
            </p>
          </ScrollReveal>

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
      </div>

      {/* Tabs - greytHR style bottom bar */}
      <div className="sticky bottom-0 sm:relative sm:bottom-auto z-20 bg-card border-t sm:border-t-0 border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-1 p-1 sm:gap-2">
            {[
              { key: 'plans', label: '📋 Plans' },
              { key: 'comparison', label: '⚖️ Price Comparison' },
              { key: 'faq', label: '❓ FAQs' },
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
      <div className="container mx-auto px-4 pb-24 sm:pb-20 pt-6 sm:pt-10 flex-1">
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

                        <div className="mb-2">
                          <span className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
                            {formatPrice(plan.price, plan.currency)}
                          </span>
                          {plan.price > 0 && (
                            <span className="text-muted-foreground text-sm ml-1">
                              /{INTERVAL_LABELS[plan.billing_interval] || plan.billing_interval}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-5">(Includes 50 Employees)</p>

                        <ul className="space-y-2.5 mb-6 flex-1">
                          {plan.features.map((feature, fi) => (
                            <li key={fi} className="flex items-start gap-2.5 text-sm">
                              <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
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

            {/* ── Comparison Tab - greytHR style ── */}
            {activeTab === 'comparison' && (
              <div className="max-w-6xl mx-auto">
                {/* Highlight header area */}
                <div className="relative rounded-t-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5" />
                  <div className="relative overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left py-6 px-5 font-display font-bold text-xl text-foreground min-w-[250px]">
                            Modules and Features
                          </th>
                          {filteredPlans.map(plan => (
                            <th key={plan.id} className="text-center py-6 px-4 min-w-[140px]">
                              <div className="font-display font-bold text-lg">{plan.name}</div>
                              <div className="mt-1">
                                {plan.price === 0 ? (
                                  <div className="text-2xl font-bold text-foreground">0</div>
                                ) : (
                                  <div>
                                    <span className="text-xs text-muted-foreground">{plan.currency === 'INR' ? '₹' : plan.currency} </span>
                                    <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                                    <span className="text-xs text-muted-foreground"> {INTERVAL_LABELS[plan.billing_interval]?.split('/')[0] || plan.billing_interval}</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">(Includes 50 Employees)</p>
                              <Button size="sm" variant={plan.is_popular ? 'default' : 'outline'} className="mt-3 text-xs" onClick={() => navigate('/auth')}>
                                Start Free Trial
                              </Button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                    </table>
                  </div>
                </div>

                {/* Feature rows by category */}
                <div className="border border-border/50 rounded-b-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {categories.map(cat => {
                          const catFeatures = features.filter(f => f.category === cat);
                          const isExpanded = expandedCategories.has(cat);
                          return (
                            <React.Fragment key={cat}>
                              <tr
                                className="border-b border-border/30 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => toggleCategory(cat)}
                              >
                                <td className="py-3 px-5 font-semibold text-foreground min-w-[250px]">
                                  <div className="flex items-center gap-2">
                                    <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                                    {cat}
                                    <Badge variant="secondary" className="text-[10px]">{catFeatures.length}</Badge>
                                  </div>
                                </td>
                                {filteredPlans.map(plan => (
                                  <td key={plan.id} className="text-center py-3 px-4 min-w-[140px]" />
                                ))}
                              </tr>
                              {isExpanded && catFeatures.map((feat, fi) => (
                                <tr key={feat.name} className={cn("border-b border-border/20 transition-colors", fi % 2 === 0 ? "bg-card" : "bg-muted/10")}>
                                  <td className="py-3 px-5 pl-10 font-medium text-foreground min-w-[250px]">
                                    {feat.name}
                                  </td>
                                  {filteredPlans.map(plan => {
                                    const status = getFeatureStatus(plan.id, feat.name);
                                    return (
                                      <td key={plan.id} className="text-center py-3 px-4 min-w-[140px]">
                                        {status === 'yes' ? (
                                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                                        ) : status === 'limited' ? (
                                          <span className="text-xs font-medium text-amber-500">Limited</span>
                                        ) : (
                                          <X className="w-5 h-5 text-destructive/50 mx-auto" />
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                              {!isExpanded && catFeatures.map(feat => (
                                <tr key={feat.name} className="border-b border-border/20">
                                  <td className="py-3 px-5 pl-10 font-medium text-foreground min-w-[250px]">
                                    <div className="flex items-center gap-2">
                                      {feat.name}
                                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                    </div>
                                  </td>
                                  {filteredPlans.map(plan => {
                                    const status = getFeatureStatus(plan.id, feat.name);
                                    return (
                                      <td key={plan.id} className="text-center py-3 px-4 min-w-[140px]">
                                        {status === 'yes' ? (
                                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                                        ) : status === 'limited' ? (
                                          <span className="text-xs font-medium text-amber-500">Limited</span>
                                        ) : (
                                          <X className="w-5 h-5 text-destructive/50 mx-auto" />
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── FAQ Tab ── */}
            {activeTab === 'faq' && (
              <div className="max-w-2xl mx-auto space-y-4">
                {[
                  { q: 'Is there a free trial?', a: 'Yes! You can start with our free trial that includes basic features for up to 50 employees. No credit card required.' },
                  { q: 'What happens after my free trial ends?', a: 'You can choose any paid plan to continue. Your data is safely preserved during the transition.' },
                  { q: 'Can I change plans later?', a: 'Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect immediately.' },
                  { q: 'Is there a setup fee?', a: 'No, there are no setup fees. You can get started in minutes with zero upfront cost.' },
                  { q: 'What payment methods are accepted?', a: 'We accept all major credit/debit cards, UPI, and bank transfers for annual plans.' },
                  { q: 'How many employees can I add?', a: 'All plans include 50 employees. You can add more employees with our add-on packages.' },
                  { q: 'Do you offer custom enterprise plans?', a: 'Yes, for large organizations with 500+ employees, we offer custom pricing with dedicated support and SLA guarantees.' },
                  { q: 'Can I get a demo?', a: 'Yes! Contact our sales team for a personalized demo of all features.' },
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
