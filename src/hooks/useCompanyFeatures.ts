import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyFeatures {
  moodPulseEnabled: boolean;
  teamBoardEnabled: boolean;
  commandPaletteEnabled: boolean;
}

const defaults: CompanyFeatures = {
  moodPulseEnabled: false,
  teamBoardEnabled: false,
  commandPaletteEnabled: false,
};

export function useCompanyFeatures() {
  const { profile, isDeveloper, isAdmin } = useAuth();
  const [features, setFeatures] = useState<CompanyFeatures>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }

    supabase
      .from('companies')
      .select('mood_pulse_enabled, team_board_enabled, command_palette_enabled')
      .eq('id', profile.company_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFeatures({
            moodPulseEnabled: (data as any).mood_pulse_enabled ?? false,
            teamBoardEnabled: (data as any).team_board_enabled ?? false,
            commandPaletteEnabled: (data as any).command_palette_enabled ?? false,
          });
        }
        setLoading(false);
      });
  }, [profile?.company_id]);

  // Developers and admins always see features (for preview/testing)
  const isPrivileged = isDeveloper || isAdmin;

  return {
    ...features,
    loading,
    // Privileged users always have access
    canSeeMoodPulse: isPrivileged || features.moodPulseEnabled,
    canSeeTeamBoard: isPrivileged || features.teamBoardEnabled,
    canSeeCommandPalette: isPrivileged || features.commandPaletteEnabled,
  };
}
