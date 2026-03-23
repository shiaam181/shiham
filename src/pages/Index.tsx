import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  Clock, Shield, MapPin, ArrowRight, Users, Smartphone, Download,
  CheckCircle2, BarChart3, Calendar, FileText, Zap, Globe,
  ChevronRight, Play, Star
} from 'lucide-react';
import { AnimatedCounter } from '@/components/landing/AnimatedCounter';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

// Floating shapes component for hero background
function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large circle top-right */}
      <div 
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full border border-primary/10"
        style={{ animation: 'float1 20s ease-in-out infinite' }}
      />
      {/* Medium circle bottom-left */}
      <div 
        className="absolute -bottom-20 -left-20 w-[350px] h-[350px] rounded-full bg-primary/[0.03]"
        style={{ animation: 'float2 15s ease-in-out infinite' }}
      />
      {/* Small accent dots */}
      <div className="absolute top-1/4 right-1/4 w-3 h-3 rounded-full bg-primary/20" style={{ animation: 'float3 8s ease-in-out infinite' }} />
      <div className="absolute top-2/3 left-1/3 w-2 h-2 rounded-full bg-primary/15" style={{ animation: 'float1 12s ease-in-out infinite' }} />
      <div className="absolute top-1/3 left-1/5 w-4 h-4 rounded-full border border-primary/10" style={{ animation: 'float2 10s ease-in-out infinite' }} />
    </div>
  );
}

// Navbar component
function LandingNav() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-card/95 backdrop-blur-xl shadow-sm border-b border-border/50' : 'bg-transparent'}`}>
      <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between h-16 sm:h-[72px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm sm:text-base">Z</span>
          </div>
          <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-foreground">
            Zentrek
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/auth')} className="text-sm font-medium">
            Login
          </Button>
          <Button size="sm" onClick={() => navigate('/auth')} className="text-sm font-semibold px-4 sm:px-5 shadow-md">
            Get Started
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

// Hero Section
function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] sm:min-h-screen flex items-center pt-20 sm:pt-24 pb-12 sm:pb-20 overflow-hidden bg-background">
      <FloatingShapes />
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/15 mb-6 sm:mb-8">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-xs sm:text-sm font-medium text-primary">Trusted by 500+ companies</span>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="text-3xl sm:text-5xl lg:text-[3.5rem] font-display font-bold tracking-tight text-foreground leading-[1.15] mb-5 sm:mb-6">
              Welcome to the{' '}
              <span className="text-primary relative">
                smart
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                  <path d="M2 6C50 2 150 2 198 6" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                </svg>
              </span>
              {' '}side of HR.
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8 sm:mb-10">
              The most trusted full-suite HRMS for your people operations. Track attendance, manage payroll, and simplify HR — all in one platform.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-12 sm:mb-16">
              <Button onClick={() => navigate('/auth')} size="lg" className="w-full sm:w-auto font-semibold px-8 shadow-lg hover:shadow-xl transition-all text-base h-12">
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button onClick={() => navigate('/pricing')} variant="outline" size="lg" className="w-full sm:w-auto px-8 h-12 text-base">
                View Pricing
              </Button>
            </div>
          </ScrollReveal>

          {/* Stats Row */}
          <ScrollReveal delay={400}>
            <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-xl mx-auto">
              {[
                { icon: Globe, value: 25, suffix: '+', label: 'Countries' },
                { icon: Users, value: 500, suffix: '+', label: 'Companies' },
                { icon: CheckCircle2, value: 50000, suffix: '+', label: 'Users' },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="group flex flex-col items-center gap-1.5 p-3 sm:p-5 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-1 group-hover:bg-primary/15 transition-colors">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xl sm:text-2xl font-display font-bold text-foreground">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </span>
                  <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">{stat.label}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

// Features Section
function FeaturesSection() {
  const features = [
    { icon: Clock, title: 'Real-time Attendance', desc: 'GPS-verified check-in/out with instant notifications and live tracking.', color: 'text-primary' },
    { icon: Shield, title: 'Face Verification', desc: 'AI-powered biometric attendance with liveness detection for security.', color: 'text-success' },
    { icon: MapPin, title: 'Geofencing', desc: 'Define office boundaries and enforce location-based attendance rules.', color: 'text-warning' },
    { icon: Calendar, title: 'Leave Management', desc: 'Automated leave policies, approval workflows, and balance tracking.', color: 'text-info' },
    { icon: BarChart3, title: 'Payroll & Reports', desc: 'One-click payroll processing with statutory compliance built in.', color: 'text-destructive' },
    { icon: Zap, title: 'Smart Automation', desc: 'Auto punch-out, shift management, and intelligent notifications.', color: 'text-primary' },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6">
        <ScrollReveal>
          <div className="text-center mb-10 sm:mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 block">Features</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight text-foreground mb-3">
              Everything you need to manage HR
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm sm:text-base">
              A complete platform designed to simplify every aspect of your people operations.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 80}>
              <div className="group p-5 sm:p-6 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 h-full">
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-display font-semibold text-base text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// How it Works Section
function HowItWorksSection() {
  const steps = [
    { step: '01', title: 'Create Your Account', desc: 'Sign up in seconds. Set up your company profile and invite your team.' },
    { step: '02', title: 'Configure Policies', desc: 'Set up shifts, leave policies, geofence locations, and payroll rules.' },
    { step: '03', title: 'Go Live', desc: 'Your team starts checking in. Everything tracks automatically.' },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <ScrollReveal>
          <div className="text-center mb-10 sm:mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 block">How it Works</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight text-foreground mb-3">
              Get started in minutes
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm sm:text-base">
              Three simple steps to transform your HR operations.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto">
          {steps.map((s, i) => (
            <ScrollReveal key={s.step} delay={i * 120}>
              <div className="relative text-center p-6 sm:p-8">
                <div className="text-5xl sm:text-6xl font-display font-bold text-primary/10 mb-4">{s.step}</div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/3 -right-4 text-primary/20">
                    <ChevronRight className="w-8 h-8" />
                  </div>
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// Testimonial/Trust Section
function TrustSection() {
  return (
    <section className="py-16 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-warning fill-warning" />
              ))}
            </div>
            <blockquote className="text-lg sm:text-xl lg:text-2xl font-display text-foreground leading-relaxed mb-6">
              "Zentrek transformed how we manage our workforce. Attendance tracking is now effortless, and our HR team saves hours every week."
            </blockquote>
            <div>
              <p className="font-semibold text-foreground">HR Director</p>
              <p className="text-sm text-muted-foreground">Leading Technology Company</p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  const navigate = useNavigate();
  
  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <ScrollReveal>
          <div className="max-w-2xl mx-auto text-center rounded-3xl bg-primary/5 border border-primary/15 p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground mb-3">
              Ready to get started?
            </h2>
            <p className="text-muted-foreground mb-8 text-sm sm:text-base">
              Join hundreds of companies already using Zentrek. Free to start, no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/auth')} size="lg" className="font-semibold px-8 shadow-lg h-12 text-base">
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button onClick={() => navigate('/pricing')} variant="outline" size="lg" className="px-8 h-12 text-base">
                Compare Plans
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// Footer
function LandingFooter() {
  return (
    <footer className="py-8 sm:py-10 border-t border-border/50 bg-card">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">Z</span>
            </div>
            <span className="font-display font-semibold text-foreground">Zentrek</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/contact-support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
          <span className="text-xs text-muted-foreground">© 2026 Zentrek. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Index Page ───────────────────────────────────────────

export default function Index() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [showMarketing, setShowMarketing] = useState(false);
  const [appStoreRedirect, setAppStoreRedirect] = useState(false);
  const [storeLinks, setStoreLinks] = useState<{ play_store?: string; app_store?: string }>({});

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!isLoading && user) {
        navigate('/dashboard');
        return;
      }

      if (!isLoading && !user) {
        const { data, error } = await supabase.rpc('get_public_auth_settings' as never);
        if (error) console.error('Failed to load public auth settings:', error);

        const rows = data as Array<{ key: string; value: Record<string, unknown> }> | null;
        const marketingSetting = rows?.find((row) => row.key === 'show_marketing_landing_page');
        const marketingEnabled = (marketingSetting?.value as any)?.enabled ?? false;
        const redirectSetting = rows?.find((row) => row.key === 'app_store_redirect_enabled');
        const redirectEnabled = (redirectSetting?.value as any)?.enabled ?? false;
        const linksSetting = rows?.find((row) => row.key === 'app_store_links');
        const links = linksSetting?.value as { play_store?: string; app_store?: string } ?? {};

        setShowMarketing(!!marketingEnabled);
        setAppStoreRedirect(!!redirectEnabled);
        setStoreLinks(links);

        if (redirectEnabled) {
          setCheckingSettings(false);
          return;
        }
        if (!marketingEnabled) {
          navigate('/auth');
        }
        setCheckingSettings(false);
      }
    };
    checkAndRedirect();
  }, [user, isLoading, navigate]);

  if (isLoading || checkingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // App Store Redirect Landing Page
  if (appStoreRedirect) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <LandingNav />
        <div className="gradient-hero relative overflow-hidden flex-1 flex items-center pt-20">
          <FloatingShapes />
          <div className="container mx-auto px-4 py-16 sm:py-24 relative z-10">
            <div className="max-w-lg mx-auto text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mx-auto mb-8">
                <Smartphone className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight mb-4">
                Get the App
              </h1>
              <p className="text-white/60 text-lg mb-10 max-w-md mx-auto leading-relaxed">
                Download our app for the best experience. Available on Android and iOS.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
                {storeLinks.play_store && (
                  <a href={storeLinks.play_store} target="_blank" rel="noopener noreferrer">
                    <div className="flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-6 py-3.5 transition-all">
                      <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
                        <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 010 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
                      </svg>
                      <div className="text-left">
                        <p className="text-white/60 text-[10px] uppercase tracking-wider">Get it on</p>
                        <p className="text-white font-semibold text-lg leading-tight">Google Play</p>
                      </div>
                    </div>
                  </a>
                )}
                {storeLinks.app_store && (
                  <a href={storeLinks.app_store} target="_blank" rel="noopener noreferrer">
                    <div className="flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-6 py-3.5 transition-all">
                      <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      <div className="text-left">
                        <p className="text-white/60 text-[10px] uppercase tracking-wider">Download on the</p>
                        <p className="text-white font-semibold text-lg leading-tight">App Store</p>
                      </div>
                    </div>
                  </a>
                )}
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className="text-white/40 text-sm">or</span>
                <Button variant="ghost" onClick={() => navigate('/auth')} className="text-white/60 hover:text-white hover:bg-white/10">
                  Continue on Web <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <LandingFooter />
      </div>
    );
  }

  if (showMarketing) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <LandingNav />
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TrustSection />
        <CTASection />
        <LandingFooter />
      </div>
    );
  }

  return null;
}
