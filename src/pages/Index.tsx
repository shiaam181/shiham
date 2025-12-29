import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function Index() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [checkingSettings, setCheckingSettings] = useState(true);

  useEffect(() => {
    const checkAndRedirect = async () => {
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

        const showMarketing = data?.value && (data.value as { enabled: boolean }).enabled;
        
        if (!showMarketing) {
          // Go straight to auth page
          navigate('/auth');
        }
        setCheckingSettings(false);
      }
    };

    checkAndRedirect();
  }, [user, isLoading, navigate]);

  // Show loading while checking
  if (isLoading || checkingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // This would only show if marketing is enabled - currently just redirects
  return null;
}
