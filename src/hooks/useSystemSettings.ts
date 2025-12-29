import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SystemSettings {
  faceVerificationEnabled: boolean;
  gpsTrackingEnabled: boolean;
  photoCaptureEnabled: boolean;
  leaveManagementEnabled: boolean;
  overtimeTrackingEnabled: boolean;
  marketingPageEnabled: boolean;
  emailServiceId: string;
  emailTemplateId: string;
  emailPublicKey: string;
}

const defaultSettings: SystemSettings = {
  faceVerificationEnabled: true,
  gpsTrackingEnabled: true,
  photoCaptureEnabled: true,
  leaveManagementEnabled: true,
  overtimeTrackingEnabled: true,
  marketingPageEnabled: false,
  emailServiceId: '',
  emailTemplateId: '',
  emailPublicKey: '',
};

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');
      
      if (error) throw error;

      const newSettings = { ...defaultSettings };
      
      data?.forEach((setting) => {
        const value = setting.value as { enabled?: boolean; service_id?: string; template_id?: string; public_key?: string };
        switch (setting.key) {
          case 'face_verification_required':
            newSettings.faceVerificationEnabled = value?.enabled ?? true;
            break;
          case 'gps_tracking_enabled':
            newSettings.gpsTrackingEnabled = value?.enabled ?? true;
            break;
          case 'photo_capture_enabled':
            newSettings.photoCaptureEnabled = value?.enabled ?? true;
            break;
          case 'leave_management_enabled':
            newSettings.leaveManagementEnabled = value?.enabled ?? true;
            break;
          case 'overtime_tracking_enabled':
            newSettings.overtimeTrackingEnabled = value?.enabled ?? true;
            break;
          case 'show_marketing_landing_page':
            newSettings.marketingPageEnabled = value?.enabled ?? false;
            break;
          case 'emailjs_config':
            newSettings.emailServiceId = value?.service_id ?? '';
            newSettings.emailTemplateId = value?.template_id ?? '';
            newSettings.emailPublicKey = value?.public_key ?? '';
            break;
        }
      });

      setSettings(newSettings);
    } catch (error) {
      console.error('Error fetching system settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, isLoading, refetch: fetchSettings };
}

export function isEmailConfigured(settings: SystemSettings): boolean {
  return !!(
    settings.emailServiceId &&
    settings.emailTemplateId &&
    settings.emailPublicKey &&
    settings.emailServiceId !== 'YOUR_SERVICE_ID' &&
    settings.emailTemplateId !== 'YOUR_TEMPLATE_ID' &&
    settings.emailPublicKey !== 'YOUR_PUBLIC_KEY'
  );
}
