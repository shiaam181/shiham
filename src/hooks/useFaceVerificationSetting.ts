import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to determine if face verification is required for the current user.
 * Checks both global system setting AND per-company override.
 */
export function useFaceVerificationSetting() {
  const { profile, isDeveloper } = useAuth();
  const [isRequired, setIsRequired] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      // Developers always bypass
      if (isDeveloper) {
        setIsRequired(false);
        setIsLoading(false);
        return;
      }

      try {
        // Check global setting
        const { data: globalSetting } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'face_verification_required')
          .maybeSingle();

        const globalEnabled = globalSetting
          ? (globalSetting.value as { enabled: boolean }).enabled
          : true;

        // If globally disabled, no need to check company
        if (!globalEnabled) {
          setIsRequired(false);
          setIsLoading(false);
          return;
        }

        // Check company-level override
        if (profile?.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('face_verification_disabled')
            .eq('id', profile.company_id)
            .maybeSingle();

          // If company has disabled face verification, override
          if (company?.face_verification_disabled) {
            setIsRequired(false);
            setIsLoading(false);
            return;
          }
        }

        // Default: face verification required
        setIsRequired(true);
      } catch (error) {
        console.error('Error fetching face verification settings:', error);
        // Default to required on error
        setIsRequired(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [profile?.company_id, isDeveloper]);

  return { isRequired, isLoading };
}
