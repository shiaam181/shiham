import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export default function Index() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [showMarketing, setShowMarketing] = useState(false);

  // Check for invite code in URL
  const inviteCode = searchParams.get('invite');

  useEffect(() => {
    const checkAndRedirect = async () => {
      // If invite code is present, go directly to register page with invite
      if (inviteCode) {
        navigate(`/auth?invite=${inviteCode}`);
        return;
      }

      // If user is logged in, go to dashboard
      if (!isLoading && user) {
        navigate('/dashboard');
        return;
      }

      // Check if marketing page is enabled
      if (!isLoading && !user) {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'show_marketing_landing_page')
          .maybeSingle();

        const marketingEnabled = data?.value && (data.value as { enabled: boolean }).enabled;
        setShowMarketing(!!marketingEnabled);
        
        if (!marketingEnabled) {
          // Go straight to auth page
          navigate('/auth');
        }
        setCheckingSettings(false);
      }
    };

    checkAndRedirect();
  }, [user, isLoading, navigate, inviteCode]);

  // Show loading while checking
  if (isLoading || checkingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Show marketing landing page
  if (showMarketing) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 flex flex-col items-center justify-center px-4">
          <h1 className="text-4xl font-bold text-center mb-4">Attendance Management System</h1>
          <p className="text-muted-foreground text-center mb-8 max-w-md">
            Track attendance, manage leaves, and monitor your workforce with ease.
          </p>
          <Button onClick={() => navigate('/auth')} size="lg">
            Get Started
          </Button>
        </main>
        
        <footer className="py-6 px-4 border-t">
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>© 2026 Attendance System</span>
            <div className="flex gap-4">
              <Link to="/privacy" className="hover:text-foreground underline">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-foreground underline">
                Terms of Service
              </Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return null;
}
