import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyFeatures {
  moodPulseEnabled: boolean;
  teamBoardEnabled: boolean;
  commandPaletteEnabled: boolean;
  separatePayrollTeamEnabled: boolean;
}

const defaults: CompanyFeatures = {
  moodPulseEnabled: false,
  teamBoardEnabled: false,
  commandPaletteEnabled: false,
  separatePayrollTeamEnabled: false,
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
      .select('mood_pulse_enabled, team_board_enabled, command_palette_enabled, separate_payroll_team_enabled')
      .eq('id', profile.company_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFeatures({
            moodPulseEnabled: (data as any).mood_pulse_enabled ?? false,
            teamBoardEnabled: (data as any).team_board_enabled ?? false,
            commandPaletteEnabled: (data as any).command_palette_enabled ?? false,
            separatePayrollTeamEnabled: (data as any).separate_payroll_team_enabled ?? false,
          });
        }
        setLoading(false);
      });
  }, [profile?.company_id]);

  return {
    ...features,
    loading,
    canSeeMoodPulse: features.moodPulseEnabled,
    canSeeTeamBoard: features.teamBoardEnabled,
    canSeeCommandPalette: features.commandPaletteEnabled,
    canSeePayrollTeamRole: features.separatePayrollTeamEnabled,
  };
}
