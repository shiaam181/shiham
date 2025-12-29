import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useFaceVerificationSetting() {
  const [isRequired, setIsRequired] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSetting = async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'face_verification_required')
        .maybeSingle();
      
      if (!error && data) {
        setIsRequired((data.value as { enabled: boolean }).enabled);
      }
      setIsLoading(false);
    };

    fetchSetting();
  }, []);

  return { isRequired, isLoading };
}