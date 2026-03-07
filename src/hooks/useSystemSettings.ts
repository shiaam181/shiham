import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SystemSettings {
  faceVerificationEnabled: boolean;
  faceVerificationThreshold: number;
  gpsTrackingEnabled: boolean;
  photoCaptureEnabled: boolean;
  leaveManagementEnabled: boolean;
  overtimeTrackingEnabled: boolean;
  marketingPageEnabled: boolean;
  emailServiceId: string;
  emailTemplateId: string;
  emailPublicKey: string;
  phoneOtpEnabled: boolean;
  emailOtpEnabled: boolean;
  passwordLoginEnabled: boolean;
  resendApiKey: string;
  googleSigninEnabled: boolean;
  oauthPhoneVerificationEnabled: boolean;
  appOnlyModeEnabled: boolean;
  testingModeEnabled: boolean;
}

const defaultSettings: SystemSettings = {
  faceVerificationEnabled: true,
  faceVerificationThreshold: 70,
  gpsTrackingEnabled: true,
  photoCaptureEnabled: true,
  leaveManagementEnabled: true,
  overtimeTrackingEnabled: true,
  marketingPageEnabled: false,
  emailServiceId: '',
  emailTemplateId: '',
  emailPublicKey: '',
  phoneOtpEnabled: false,
  emailOtpEnabled: false,
  passwordLoginEnabled: true,
  resendApiKey: '',
  googleSigninEnabled: true,
  oauthPhoneVerificationEnabled: true,
  appOnlyModeEnabled: false,
  testingModeEnabled: false,
};

// Global cache to avoid re-fetching on every component mount
let cachedSettings: SystemSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(cachedSettings || defaultSettings);
  const [isLoading, setIsLoading] = useState(!cachedSettings);

  const fetchSettings = useCallback(async (force = false) => {
    // Use cache if still fresh and not forced
    if (!force && cachedSettings && Date.now() - cacheTimestamp < CACHE_TTL) {
      setSettings(cachedSettings);
      setIsLoading(false);
      return;
    }
    
    try {
      let settingsRows: Array<{ key: string; value: unknown }> = [];

      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) {
        // Unauthenticated users no longer read from system_settings directly.
        // Fall back to whitelisted public auth settings via SECURITY DEFINER RPC.
        const { data: publicData, error: publicError } = await supabase.rpc('get_public_auth_settings' as never);
        if (publicError) throw publicError;
        settingsRows = (publicData as Array<{ key: string; value: unknown }>) ?? [];
      } else {
        settingsRows = (data as Array<{ key: string; value: unknown }>) ?? [];
      }

      const newSettings = { ...defaultSettings };
      
      settingsRows.forEach((setting) => {
        const value = setting.value as { enabled?: boolean; service_id?: string; template_id?: string; public_key?: string; threshold?: number };
        switch (setting.key) {
          case 'face_verification_required':
            newSettings.faceVerificationEnabled = value?.enabled ?? true;
            break;
          case 'face_verification_threshold':
            newSettings.faceVerificationThreshold = value?.threshold ?? 70;
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
          case 'phone_otp_enabled':
            newSettings.phoneOtpEnabled = value?.enabled ?? false;
            break;
          case 'email_otp_enabled':
            newSettings.emailOtpEnabled = value?.enabled ?? false;
            break;
          case 'resend_config':
            newSettings.resendApiKey = (value as { api_key?: string })?.api_key ?? '';
            break;
          case 'google_signin_enabled':
            newSettings.googleSigninEnabled = value?.enabled ?? true;
            break;
          case 'password_login_enabled':
            newSettings.passwordLoginEnabled = value?.enabled ?? true;
            break;
          case 'oauth_phone_verification_enabled':
            newSettings.oauthPhoneVerificationEnabled = value?.enabled ?? true;
            break;
          case 'app_only_mode_enabled':
            newSettings.appOnlyModeEnabled = value?.enabled ?? false;
            break;
          case 'testing_mode_enabled':
            newSettings.testingModeEnabled = value?.enabled ?? false;
            break;
        }
      });

      cachedSettings = newSettings;
      cacheTimestamp = Date.now();
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

  return { settings, isLoading, refetch: () => fetchSettings(true) };
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
