import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Clock, Shield, MapPin, ArrowRight, Users, Smartphone, Download } from 'lucide-react';

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

        if (error) {
          console.error('Failed to load public auth settings:', error);
        }

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
          // Show app store redirect page
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
        {/* Hero */}
        <div className="gradient-hero relative overflow-hidden flex-1 flex items-center">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/[0.02] rounded-full translate-y-1/2 -translate-x-1/4" />

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

              {/* Store Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
                {storeLinks.play_store && (
                  <a href={storeLinks.play_store} target="_blank" rel="noopener noreferrer" className="group">
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
                  <a href={storeLinks.app_store} target="_blank" rel="noopener noreferrer" className="group">
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

              {/* Fallback web login */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-white/40 text-sm">or</span>
                <Button variant="ghost" onClick={() => navigate('/auth')} className="text-white/60 hover:text-white hover:bg-white/10">
                  Continue on Web
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="bg-background py-12 sm:py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-display font-bold mb-2">Plans & Pricing</h2>
            <p className="text-muted-foreground mb-8">Choose the right plan for your team</p>
            <Button onClick={() => navigate('/pricing')} variant="outline" size="lg" className="gap-2">
              View All Plans
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="bg-muted/30 py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { icon: Clock, title: 'Real-time Tracking', desc: 'Instant check-in/out with GPS verification.' },
                { icon: Shield, title: 'Face Verification', desc: 'AI-powered biometric attendance.' },
                { icon: MapPin, title: 'GPS Location', desc: 'Verified location for every record.' },
              ].map((f, i) => (
                <div key={i} className="text-center p-6 rounded-2xl bg-card border border-border/40 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="py-6 px-4 border-t border-border/40 bg-card">
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>© 2026 Zentrek</span>
            <div className="flex gap-4">
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (showMarketing) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Hero Section */}
        <div className="gradient-hero relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/[0.02] rounded-full translate-y-1/2 -translate-x-1/4" />
          
          <div className="container mx-auto px-4 py-20 sm:py-32 relative z-10">
            <div className="max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 mb-8">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white/70 text-sm">Enterprise-grade Attendance System</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white tracking-tight mb-6">
                Attendance Management,{' '}
                <span className="bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">Simplified</span>
              </h1>
              <p className="text-white/60 text-lg sm:text-xl mb-10 max-w-lg mx-auto leading-relaxed">
                Track attendance, manage leaves, and monitor your workforce with enterprise-grade security.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate('/auth')} size="lg" className="bg-white text-foreground hover:bg-white/90 font-semibold px-8 shadow-xl">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button onClick={() => navigate('/pricing')} variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-8">
                  View Pricing
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-background py-16 sm:py-24">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { icon: Clock, title: 'Real-time Tracking', desc: 'Instant check-in/out with GPS verification and timestamps.' },
                { icon: Shield, title: 'Face Verification', desc: 'AI-powered face recognition for secure attendance.' },
                { icon: MapPin, title: 'GPS Location', desc: 'Verified location for every attendance record.' },
              ].map((f, i) => (
                <div key={i} className="text-center p-6 rounded-2xl bg-card border border-border/40 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <footer className="py-6 px-4 border-t border-border/40 bg-card">
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>© 2026 AttendanceHub</span>
            <div className="flex gap-4">
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return null;
}
