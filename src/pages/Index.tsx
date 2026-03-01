import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Clock, Shield, MapPin, ArrowRight, Users } from 'lucide-react';

export default function Index() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [showMarketing, setShowMarketing] = useState(false);

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

        const marketingSetting = (data as Array<{ key: string; value: { enabled?: boolean } }> | null)?.find(
          (row) => row.key === 'show_marketing_landing_page'
        );
        const marketingEnabled = marketingSetting?.value?.enabled ?? false;
        setShowMarketing(!!marketingEnabled);
        
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
                <Button onClick={() => navigate('/auth')} variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-8">
                  Sign In
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
