import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings, Mail, ScanFace, Globe, MapPin, Camera, Timer, Save,
  CheckCircle2, Phone, MessageSquare, Loader2,
  Smartphone, Trash2, AlertTriangle, Shield, Key, Calendar,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import DataExportImport from '@/components/DataExportImport';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Professional settings components
import { SettingsSection } from '@/components/settings/SettingsSection';
import { StatusBadge } from '@/components/settings/StatusBadge';
import { FeatureToggle } from '@/components/settings/FeatureToggle';
import { CredentialField } from '@/components/settings/CredentialField';
import { TestConnection } from '@/components/settings/TestConnection';
import { InfoBanner } from '@/components/settings/InfoBanner';

export default function DeveloperSettings() {
  const { isDeveloper, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Feature toggles
  const [faceVerificationEnabled, setFaceVerificationEnabled] = useState(true);
  const [marketingPageEnabled, setMarketingPageEnabled] = useState(false);
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(true);
  const [photoCaptureEnabled, setPhotoCaptureEnabled] = useState(true);
  const [leaveManagementEnabled, setLeaveManagementEnabled] = useState(true);
  const [overtimeTrackingEnabled, setOvertimeTrackingEnabled] = useState(true);
  const [faceVerificationThreshold, setFaceVerificationThreshold] = useState(70);
  const [googleSigninEnabled, setGoogleSigninEnabled] = useState(true);
  const [passwordLoginEnabled, setPasswordLoginEnabled] = useState(true);
  const [oauthPhoneVerificationEnabled, setOauthPhoneVerificationEnabled] = useState(true);
  const [appOnlyModeEnabled, setAppOnlyModeEnabled] = useState(false);
  const [testingModeEnabled, setTestingModeEnabled] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [clearDataStep, setClearDataStep] = useState(0);
  const [clearingData, setClearingData] = useState(false);

  // EmailJS
  const [emailServiceId, setEmailServiceId] = useState('');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [emailPublicKey, setEmailPublicKey] = useState('');
  const [emailConfigSaving, setEmailConfigSaving] = useState(false);

  // Phone OTP
  const [phoneOtpEnabled, setPhoneOtpEnabled] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [twilioConfigSaving, setTwilioConfigSaving] = useState(false);
  const [twilioBackendConfigured, setTwilioBackendConfigured] = useState(false);

  // Email OTP
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(true);
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendConfigSaving, setResendConfigSaving] = useState(false);
  const [resendBackendConfigured, setResendBackendConfigured] = useState(false);

  // SMS Templates
  const [smsTemplateSignup, setSmsTemplateSignup] = useState('Your AttendanceHub verification code is: {{OTP}}. This code expires in 5 minutes.');
  const [smsTemplateLogin, setSmsTemplateLogin] = useState('Your AttendanceHub login code is: {{OTP}}. This code expires in 5 minutes.');
  const [smsTemplatesSaving, setSmsTemplatesSaving] = useState(false);

  // Test states
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [twilioTestResult, setTwilioTestResult] = useState<'success' | 'error' | null>(null);
  const [testingResend, setTestingResend] = useState(false);
  const [resendTestResult, setResendTestResult] = useState<'success' | 'error' | null>(null);
  const [testingEmailJS, setTestingEmailJS] = useState(false);
  const [emailJSTestResult, setEmailJSTestResult] = useState<'success' | 'error' | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');

  // Face verification (AWS)
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsConfigSaving, setAwsConfigSaving] = useState(false);
  const [awsConfigured, setAwsConfigured] = useState(false);
  const [awsAccessKeyMasked, setAwsAccessKeyMasked] = useState('');
  const [testingAws, setTestingAws] = useState(false);
  const [awsTestResult, setAwsTestResult] = useState<'success' | 'error' | null>(null);

  // Map service
  const [awsLocationMapName, setAwsLocationMapName] = useState('');
  const [awsLocationRegion, setAwsLocationRegion] = useState('ap-south-1');
  const [awsLocationPlaceIndex, setAwsLocationPlaceIndex] = useState('');
  const [newMapName, setNewMapName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newPlaceIndex, setNewPlaceIndex] = useState('');
  const [awsLocationConfigured, setAwsLocationConfigured] = useState(false);
  const [savingAwsLocation, setSavingAwsLocation] = useState(false);
  const [testingAwsLocation, setTestingAwsLocation] = useState(false);
  const [awsLocationTestResult, setAwsLocationTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase.from('system_settings').select('key, value');
    if (!error && data) {
      data.forEach((setting) => {
        switch (setting.key) {
          case 'face_verification_required': setFaceVerificationEnabled((setting.value as any)?.enabled ?? true); break;
          case 'show_marketing_landing_page': setMarketingPageEnabled((setting.value as any)?.enabled ?? false); break;
          case 'gps_tracking_enabled': setGpsTrackingEnabled((setting.value as any)?.enabled ?? true); break;
          case 'photo_capture_enabled': setPhotoCaptureEnabled((setting.value as any)?.enabled ?? true); break;
          case 'leave_management_enabled': setLeaveManagementEnabled((setting.value as any)?.enabled ?? true); break;
          case 'overtime_tracking_enabled': setOvertimeTrackingEnabled((setting.value as any)?.enabled ?? true); break;
          case 'face_verification_threshold': setFaceVerificationThreshold((setting.value as any)?.threshold ?? 70); break;
          case 'emailjs_config': {
            const c = setting.value as any;
            setEmailServiceId(c?.service_id || ''); setEmailTemplateId(c?.template_id || ''); setEmailPublicKey(c?.public_key || '');
            break;
          }
          case 'phone_otp_enabled': setPhoneOtpEnabled((setting.value as any)?.enabled ?? true); break;
          case 'email_otp_enabled': setEmailOtpEnabled((setting.value as any)?.enabled ?? true); break;
          case 'resend_config': {
            const apiKey = (setting.value as any)?.api_key || '';
            setResendApiKey(apiKey === 'configured_via_backend' ? '' : apiKey);
            setResendBackendConfigured(apiKey === 'configured_via_backend' || apiKey === '');
            break;
          }
          case 'sms_templates': {
            const t = setting.value as any;
            if (t?.otp_signup) setSmsTemplateSignup(t.otp_signup);
            if (t?.otp_login) setSmsTemplateLogin(t.otp_login);
            break;
          }
          case 'google_signin_enabled': setGoogleSigninEnabled((setting.value as any)?.enabled ?? true); break;
          case 'password_login_enabled': setPasswordLoginEnabled((setting.value as any)?.enabled ?? true); break;
          case 'oauth_phone_verification_enabled': setOauthPhoneVerificationEnabled((setting.value as any)?.enabled ?? true); break;
          case 'app_only_mode_enabled': setAppOnlyModeEnabled((setting.value as any)?.enabled ?? false); break;
          case 'testing_mode_enabled': setTestingModeEnabled((setting.value as any)?.enabled ?? false); break;
        }
      });
    }
    checkTwilioConfig(); checkAwsConfig(); checkAwsLocationConfig();
  };

  const checkAwsConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('update-aws-credentials', { body: { action: 'get' } });
      if (!error && data) { setAwsConfigured(data.configured || false); setAwsAccessKeyMasked(data.accessKeyMasked || ''); }
    } catch (err) { console.error('Error checking face verification config:', err); }
  };

  const testAwsCredentials = async () => {
    setTestingAws(true); setAwsTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('update-aws-credentials', {
        body: { action: 'test', accessKeyId: awsAccessKeyId || undefined, secretAccessKey: awsSecretAccessKey || undefined }
      });
      if (error) throw error;
      if (data?.success) { setAwsTestResult('success'); toast({ title: 'Test Passed', description: data.message || 'Credentials valid' }); }
      else throw new Error(data?.error || 'Test failed');
    } catch (error: any) {
      setAwsTestResult('error'); toast({ title: 'Test Failed', description: error.message, variant: 'destructive' });
    } finally { setTestingAws(false); }
  };

  const checkAwsLocationConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('test-aws-location', { body: { action: 'get-config' } });
      if (!error && data) {
        setAwsLocationConfigured(data.configured || false);
        setAwsLocationMapName(data.mapName || ''); setAwsLocationRegion(data.region || 'ap-south-1'); setAwsLocationPlaceIndex(data.placeIndexName || '');
      }
    } catch (err) { console.error('Error checking map service config:', err); }
  };

  const testAwsLocation = async () => {
    setTestingAwsLocation(true); setAwsLocationTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-aws-location', { body: { action: 'test' } });
      if (error) throw error;
      if (data?.success) { setAwsLocationTestResult('success'); setAwsLocationConfigured(true); toast({ title: 'Test Passed', description: data.message }); }
      else throw new Error(data?.error || 'Test failed');
    } catch (error: any) {
      setAwsLocationTestResult('error'); toast({ title: 'Test Failed', description: error.message, variant: 'destructive' });
    } finally { setTestingAwsLocation(false); }
  };

  const saveMapConfig = async () => {
    setSavingAwsLocation(true);
    try {
      const { error } = await supabase.functions.invoke('test-aws-location', {
        body: { action: 'save-map-config', mapName: newMapName || awsLocationMapName, region: newRegion || awsLocationRegion, placeIndexName: newPlaceIndex || awsLocationPlaceIndex }
      });
      if (error) throw error;
      toast({ title: 'Saved', description: 'Update Cloud secrets for changes to take effect.' });
      setNewMapName(''); setNewRegion(''); setNewPlaceIndex(''); checkAwsLocationConfig();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setSavingAwsLocation(false); }
  };

  const saveEmailConfig = async () => {
    setEmailConfigSaving(true);
    const { error } = await supabase.from('system_settings').upsert({
      key: 'emailjs_config', value: { service_id: emailServiceId, template_id: emailTemplateId, public_key: emailPublicKey }
    }, { onConflict: 'key' });
    toast(error ? { title: 'Error', description: 'Failed to save', variant: 'destructive' as const } : { title: 'Saved', description: 'Email configuration saved' });
    setEmailConfigSaving(false);
  };

  const isEmailConfigured = !!(emailServiceId && emailTemplateId && emailPublicKey);

  const checkTwilioConfig = async () => {
    const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'twilio_config').maybeSingle();
    if (error || !data?.value) { setTwilioBackendConfigured(true); setTwilioConfigured(false); return; }
    const config = data.value as any;
    const isPlaceholder = config.account_sid === 'configured_via_backend';
    setTwilioBackendConfigured(isPlaceholder);
    setTwilioAccountSid(isPlaceholder ? '' : (config.account_sid || ''));
    setTwilioAuthToken(isPlaceholder ? '' : (config.auth_token || ''));
    setTwilioPhoneNumber(isPlaceholder ? '' : (config.phone_number || ''));
    setTwilioConfigured(isPlaceholder || !!(config.account_sid && config.auth_token && config.phone_number));
  };

  const saveTwilioConfig = async () => {
    setTwilioConfigSaving(true);
    const { error } = await supabase.from('system_settings').upsert({
      key: 'twilio_config', value: { account_sid: twilioAccountSid, auth_token: twilioAuthToken, phone_number: twilioPhoneNumber }
    }, { onConflict: 'key' });
    if (error) toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    else { setTwilioConfigured(true); toast({ title: 'Saved', description: 'SMS configuration saved' }); }
    setTwilioConfigSaving(false);
  };

  const isTwilioConfigured = twilioBackendConfigured || !!(twilioAccountSid && twilioAuthToken && twilioPhoneNumber);
  const isResendConfigured = resendBackendConfigured || !!resendApiKey;

  const updateSetting = async (key: string, enabled: boolean, setter: (val: boolean) => void, msg: string) => {
    setSettingsLoading(true);
    const { error } = await supabase.from('system_settings').upsert({ key, value: { enabled } }, { onConflict: 'key' });
    if (error) toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    else { setter(enabled); toast({ title: 'Updated', description: msg }); }
    setSettingsLoading(false);
  };

  const togglePhoneOtp = (e: boolean) => updateSetting('phone_otp_enabled', e, setPhoneOtpEnabled, `Phone OTP ${e ? 'enabled' : 'disabled'}`);
  const toggleEmailOtp = (e: boolean) => updateSetting('email_otp_enabled', e, setEmailOtpEnabled, `Email OTP ${e ? 'enabled' : 'disabled'}`);
  const toggleFaceVerification = async (enabled: boolean) => {
    setSettingsLoading(true);
    const { error } = await supabase.from('system_settings').update({ value: { enabled } }).eq('key', 'face_verification_required');
    if (!error) { setFaceVerificationEnabled(enabled); toast({ title: 'Updated', description: `Face verification ${enabled ? 'enabled' : 'disabled'}` }); }
    setSettingsLoading(false);
  };
  const toggleMarketingPage = (e: boolean) => updateSetting('show_marketing_landing_page', e, setMarketingPageEnabled, e ? 'Marketing page visible' : 'Direct to login');
  const toggleGpsTracking = (e: boolean) => updateSetting('gps_tracking_enabled', e, setGpsTrackingEnabled, `GPS ${e ? 'enabled' : 'disabled'}`);
  const togglePhotoCapture = (e: boolean) => updateSetting('photo_capture_enabled', e, setPhotoCaptureEnabled, `Photo capture ${e ? 'enabled' : 'disabled'}`);
  const toggleLeaveManagement = (e: boolean) => updateSetting('leave_management_enabled', e, setLeaveManagementEnabled, `Leave management ${e ? 'enabled' : 'disabled'}`);
  const toggleOvertimeTracking = (e: boolean) => updateSetting('overtime_tracking_enabled', e, setOvertimeTrackingEnabled, `Overtime ${e ? 'enabled' : 'disabled'}`);
  const toggleGoogleSignin = (e: boolean) => updateSetting('google_signin_enabled', e, setGoogleSigninEnabled, `Google Sign-in ${e ? 'enabled' : 'disabled'}`);
  const togglePasswordLogin = (e: boolean) => updateSetting('password_login_enabled', e, setPasswordLoginEnabled, `Password login ${e ? 'enabled' : 'disabled'}`);
  const toggleOauthPhoneVerification = (e: boolean) => updateSetting('oauth_phone_verification_enabled', e, setOauthPhoneVerificationEnabled, `OAuth + Phone ${e ? 'enabled' : 'disabled'}`);
  const toggleAppOnlyMode = (e: boolean) => updateSetting('app_only_mode_enabled', e, setAppOnlyModeEnabled, `App-only mode ${e ? 'enabled' : 'disabled'}`);
  const toggleTestingMode = (e: boolean) => updateSetting('testing_mode_enabled', e, setTestingModeEnabled, `Testing mode ${e ? 'ON' : 'OFF'}`);

  const saveFaceThreshold = async (threshold: number) => {
    setSettingsLoading(true);
    const { error } = await supabase.from('system_settings').upsert({ key: 'face_verification_threshold', value: { threshold } }, { onConflict: 'key' });
    if (!error) { setFaceVerificationThreshold(threshold); toast({ title: 'Updated', description: `Threshold: ${threshold}%` }); }
    setSettingsLoading(false);
  };

  const saveResendConfig = async () => {
    setResendConfigSaving(true);
    const { error } = await supabase.from('system_settings').upsert({ key: 'resend_config', value: { api_key: resendApiKey } }, { onConflict: 'key' });
    toast(error ? { title: 'Error', variant: 'destructive' as const } : { title: 'Saved', description: 'Resend configuration saved' });
    setResendConfigSaving(false);
  };

  const saveSmsTemplates = async () => {
    setSmsTemplatesSaving(true);
    const { error } = await supabase.from('system_settings').upsert({ key: 'sms_templates', value: { otp_signup: smsTemplateSignup, otp_login: smsTemplateLogin } }, { onConflict: 'key' });
    toast(error ? { title: 'Error', variant: 'destructive' as const } : { title: 'Saved', description: 'SMS templates saved' });
    setSmsTemplatesSaving(false);
  };

  const testTwilioCredentials = async () => {
    if (!testPhone) { toast({ title: 'Required', description: 'Enter a phone number', variant: 'destructive' }); return; }
    setTestingTwilio(true); setTwilioTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', { body: { phone: testPhone, type: 'login' } });
      if (error) throw error;
      if (data?.success) { setTwilioTestResult('success'); toast({ title: 'SMS Sent', description: 'Test passed' }); }
      else throw new Error(data?.message || 'Failed');
    } catch (error: any) {
      setTwilioTestResult('error'); toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } finally { setTestingTwilio(false); }
  };

  const testResendCredentials = async () => {
    if (!testEmail) { toast({ title: 'Required', description: 'Enter an email', variant: 'destructive' }); return; }
    setTestingResend(true); setResendTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-otp', { body: { email: testEmail, type: 'verification' } });
      if (error) throw error;
      if (data?.success) { setResendTestResult('success'); toast({ title: 'Email Sent' }); }
      else throw new Error(data?.message || data?.error || 'Failed');
    } catch (error: any) {
      setResendTestResult('error'); toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } finally { setTestingResend(false); }
  };

  const testEmailJSCredentials = async () => {
    if (!isEmailConfigured) { toast({ title: 'Required', description: 'Fill in all EmailJS credentials', variant: 'destructive' }); return; }
    if (!testEmail) { toast({ title: 'Required', description: 'Enter an email', variant: 'destructive' }); return; }
    setTestingEmailJS(true); setEmailJSTestResult(null);
    try {
      const emailjs = await import('@emailjs/browser');
      await emailjs.send(emailServiceId, emailTemplateId, {
        to_email: testEmail, to_name: 'Test User', leave_type: 'Test',
        start_date: new Date().toLocaleDateString(), end_date: new Date().toLocaleDateString(),
        status: 'Approved', admin_notes: 'Test email from developer settings.',
      }, emailPublicKey);
      setEmailJSTestResult('success'); toast({ title: 'Sent', description: 'EmailJS test passed' });
    } catch (error: any) {
      setEmailJSTestResult('error'); toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } finally { setTestingEmailJS(false); }
  };

  const handleClearData = async () => {
    setClearingData(true);
    try {
      const res = await supabase.functions.invoke('clear-test-data', { body: { action: 'clear_all_data' } });
      if (res.error) throw res.error;
      toast({ title: 'Cleared', description: 'All test data removed.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setClearingData(false); setClearDataStep(0); }
  };

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 max-w-4xl">
        <PageHeader
          title="System Settings"
          description="Configure platform-wide integrations, authentication, and feature flags"
          icon={<Settings className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
        />

        {/* ═══════════════════════════════════════════ */}
        {/* AUTHENTICATION */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection
          title="Authentication"
          description="Control login methods and security options"
          icon={Shield}
        >
          <div className="space-y-3">
            <FeatureToggle label="🧪 Testing Mode" description="Bypass OTP verification for faster testing" checked={testingModeEnabled} onCheckedChange={toggleTestingMode} disabled={settingsLoading} variant="warning" />
            <FeatureToggle label="Email + Password" description="Standard email and password login" icon={Mail} checked={passwordLoginEnabled} onCheckedChange={togglePasswordLogin} disabled={settingsLoading} />
            <FeatureToggle label="Google Sign-in" description="Allow login with Google accounts" icon={Globe} checked={googleSigninEnabled} onCheckedChange={toggleGoogleSignin} disabled={settingsLoading} />
            <FeatureToggle label="Phone OTP" description="Login via phone number OTP (requires SMS provider)" icon={Phone} checked={phoneOtpEnabled} onCheckedChange={togglePhoneOtp} disabled={settingsLoading} />
            <FeatureToggle label="Email OTP" description="Login via email OTP" icon={Mail} checked={emailOtpEnabled} onCheckedChange={toggleEmailOtp} disabled={settingsLoading} />
            <FeatureToggle label="OAuth + Phone Verification" description="Require phone OTP after Google sign-in" icon={Shield} checked={oauthPhoneVerificationEnabled} onCheckedChange={toggleOauthPhoneVerification} disabled={settingsLoading} />
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════ */}
        {/* ATTENDANCE FEATURES */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection
          title="Attendance & Tracking"
          description="Configure attendance verification and tracking features"
          icon={ScanFace}
        >
          <div className="space-y-3">
            <FeatureToggle label="Face Verification" description="Require biometric face verification during attendance" icon={ScanFace} checked={faceVerificationEnabled} onCheckedChange={toggleFaceVerification} disabled={settingsLoading} />

            {faceVerificationEnabled && (
              <div className="ml-4 pl-4 border-l-2 border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Confidence Threshold</p>
                    <p className="text-xs text-muted-foreground">Minimum match confidence: <span className="text-primary font-bold">{faceVerificationThreshold}%</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8">50%</span>
                  <input type="range" min="50" max="95" step="5" value={faceVerificationThreshold} onChange={(e) => setFaceVerificationThreshold(Number(e.target.value))} className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" disabled={settingsLoading} />
                  <span className="text-xs text-muted-foreground w-8">95%</span>
                  <Button size="sm" variant="outline" onClick={() => saveFaceThreshold(faceVerificationThreshold)} disabled={settingsLoading} className="text-xs h-7"><Save className="w-3 h-3 mr-1" />Save</Button>
                </div>
                <div className="flex gap-1.5">
                  {[60, 70, 80, 90].map((val) => (
                    <Button key={val} variant={faceVerificationThreshold === val ? "default" : "outline"} size="sm" onClick={() => { setFaceVerificationThreshold(val); saveFaceThreshold(val); }} disabled={settingsLoading} className="text-xs h-7 px-3">{val}%</Button>
                  ))}
                </div>
              </div>
            )}

            <FeatureToggle label="GPS Location Tracking" description="Capture coordinates during check-in/out" icon={MapPin} checked={gpsTrackingEnabled} onCheckedChange={toggleGpsTracking} disabled={settingsLoading} />
            <FeatureToggle label="Photo Capture" description="Require photo during check-in/out" icon={Camera} checked={photoCaptureEnabled} onCheckedChange={togglePhotoCapture} disabled={settingsLoading} />
            <FeatureToggle label="Overtime Tracking" description="Automatically track overtime hours" icon={Timer} checked={overtimeTrackingEnabled} onCheckedChange={toggleOvertimeTracking} disabled={settingsLoading} />
            <FeatureToggle label="Leave Management" description="Enable leave requests and approvals" icon={Calendar} checked={leaveManagementEnabled} onCheckedChange={toggleLeaveManagement} disabled={settingsLoading} />
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════ */}
        {/* APP & PLATFORM */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection title="Platform" description="General platform behavior" icon={Smartphone}>
          <div className="space-y-3">
            <FeatureToggle label="Marketing Landing Page" description="Show landing page to visitors (otherwise redirect to login)" icon={Globe} checked={marketingPageEnabled} onCheckedChange={toggleMarketingPage} disabled={settingsLoading} />
            <FeatureToggle label="PWA / App-Only Mode" description="Require users to install the PWA before accessing the platform" icon={Smartphone} checked={appOnlyModeEnabled} onCheckedChange={toggleAppOnlyMode} disabled={settingsLoading} />
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════ */}
        {/* EMAIL NOTIFICATIONS (EmailJS) */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection
          title="Email Notifications (EmailJS)"
          description="Client-side email delivery for leave notifications"
          icon={Mail}
          badge={<StatusBadge status={isEmailConfigured ? 'configured' : 'not-configured'} />}
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <CredentialField label="Service ID" value={emailServiceId} onChange={setEmailServiceId} placeholder="service_xxxxxxx" />
              <CredentialField label="Template ID" value={emailTemplateId} onChange={setEmailTemplateId} placeholder="template_xxxxxxx" />
              <CredentialField label="Public Key" value={emailPublicKey} onChange={setEmailPublicKey} placeholder="Your public key" />
            </div>

            <TestConnection
              label="Test Delivery"
              placeholder="Enter test email address"
              value={testEmail}
              onChange={setTestEmail}
              onTest={testEmailJSCredentials}
              isTesting={testingEmailJS}
              testResult={emailJSTestResult}
              disabled={!isEmailConfigured}
            />

            <div className="flex justify-end">
              <Button onClick={saveEmailConfig} disabled={emailConfigSaving} className="gap-2">
                <Save className="w-4 h-4" />
                {emailConfigSaving ? 'Saving…' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════ */}
        {/* EMAIL OTP (Resend) */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection
          title="Email OTP Service"
          description="Fallback email service for OTP delivery"
          icon={Mail}
          badge={<StatusBadge status={isResendConfigured ? 'configured' : 'not-configured'} />}
        >
          <div className="space-y-5">
            <InfoBanner variant={isEmailConfigured ? 'success' : (isResendConfigured ? 'warning' : 'info')} icon={Key}>
              <p><strong>Priority:</strong> EmailJS → Resend (fallback)</p>
              <p className="mt-1">
                {isEmailConfigured ? '✓ EmailJS will be used for OTP delivery' : (isResendConfigured ? '⚠ Resend fallback active' : 'No email service configured')}
              </p>
            </InfoBanner>

            <CredentialField label="Resend API Key" value={resendApiKey} onChange={setResendApiKey} placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />

            <TestConnection
              label="Test Email OTP"
              placeholder="Enter test email address"
              value={testEmail}
              onChange={setTestEmail}
              onTest={testResendCredentials}
              isTesting={testingResend}
              testResult={resendTestResult}
              disabled={!isEmailConfigured && !isResendConfigured && !resendBackendConfigured}
              buttonLabel="Send Test OTP"
            />

            <div className="flex justify-end">
              <Button onClick={saveResendConfig} disabled={resendConfigSaving} className="gap-2">
                <Save className="w-4 h-4" />
                {resendConfigSaving ? 'Saving…' : 'Save Resend Key'}
              </Button>
            </div>

            {resendBackendConfigured && !isEmailConfigured && (
              <InfoBanner variant="info" icon={Key} title="Backend Secret Active">
                Resend credentials are stored as a backend secret. Configure EmailJS above for free unlimited emails.
              </InfoBanner>
            )}
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════ */}
        {/* SMS (Twilio) */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection
          title="SMS Provider (Twilio)"
          description="Phone OTP delivery for verification"
          icon={MessageSquare}
          badge={<StatusBadge status={isTwilioConfigured ? 'configured' : 'not-configured'} />}
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <CredentialField label="Account SID" value={twilioAccountSid} onChange={setTwilioAccountSid} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
              <CredentialField label="Auth Token" value={twilioAuthToken} onChange={setTwilioAuthToken} placeholder="Your auth token" />
              <CredentialField label="Phone Number" value={twilioPhoneNumber} onChange={setTwilioPhoneNumber} placeholder="+1234567890" />
            </div>

            <TestConnection
              label="Test SMS Delivery"
              placeholder="Enter test phone (+1234567890)"
              value={testPhone}
              onChange={setTestPhone}
              onTest={testTwilioCredentials}
              isTesting={testingTwilio}
              testResult={twilioTestResult}
              disabled={!isTwilioConfigured && !twilioBackendConfigured}
              inputType="tel"
              buttonLabel="Send Test SMS"
            />

            <div className="flex justify-end">
              <Button onClick={saveTwilioConfig} disabled={twilioConfigSaving} className="gap-2">
                <Save className="w-4 h-4" />
                {twilioConfigSaving ? 'Saving…' : 'Save Configuration'}
              </Button>
            </div>

            {twilioBackendConfigured && (
              <InfoBanner variant="info" icon={Key} title="Backend Secrets Active">
                Twilio credentials are stored as backend secrets.
              </InfoBanner>
            )}
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════ */}
        {/* SMS TEMPLATES */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection
          title="SMS Templates"
          description="Customize OTP message content. Use {{OTP}} as placeholder."
          icon={MessageSquare}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Signup OTP</label>
              <Textarea value={smsTemplateSignup} onChange={(e) => setSmsTemplateSignup(e.target.value)} className="font-mono text-sm bg-muted/30 min-h-[72px]" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Login OTP</label>
              <Textarea value={smsTemplateLogin} onChange={(e) => setSmsTemplateLogin(e.target.value)} className="font-mono text-sm bg-muted/30 min-h-[72px]" />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveSmsTemplates} disabled={smsTemplatesSaving} className="gap-2">
                <Save className="w-4 h-4" />
                {smsTemplatesSaving ? 'Saving…' : 'Save Templates'}
              </Button>
            </div>
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════ */}
        {/* FACE VERIFICATION CONFIG */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection
          title="Face Verification Service"
          description="Biometric verification API credentials"
          icon={ScanFace}
          badge={<StatusBadge status={awsConfigured ? 'configured' : 'not-configured'} label={awsConfigured ? `Key: ${awsAccessKeyMasked || 'Backend'}` : undefined} />}
        >
          <div className="space-y-5">
            <InfoBanner variant="info" icon={Key}>
              Credentials are stored as backend secrets. Use the fields below to test new credentials before updating secrets.
            </InfoBanner>

            <div className="grid gap-4 sm:grid-cols-2">
              <CredentialField label="Access Key ID" value={awsAccessKeyId} onChange={setAwsAccessKeyId} placeholder="Enter Access Key ID" hint="For testing only" />
              <CredentialField label="Secret Access Key" value={awsSecretAccessKey} onChange={setAwsSecretAccessKey} placeholder="Enter Secret Access Key" hint="For testing only" />
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={testAwsCredentials} disabled={testingAws} className="gap-2">
                {testingAws ? <Loader2 className="w-4 h-4 animate-spin" /> : awsTestResult === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ScanFace className="w-4 h-4" />}
                {awsAccessKeyId ? 'Test New Credentials' : 'Test Current Config'}
              </Button>
            </div>
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════ */}
        {/* MAP SERVICE CONFIG */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection
          title="Map Service"
          description="Live tracking and geofencing map configuration"
          icon={MapPin}
          badge={<StatusBadge status={awsLocationConfigured ? 'configured' : 'not-configured'} />}
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Map Name</label>
                <Input value={newMapName} onChange={(e) => setNewMapName(e.target.value)} placeholder={awsLocationMapName || 'e.g. HRMSMap'} className="bg-muted/30 font-mono text-sm" />
                {awsLocationMapName && !newMapName && <p className="text-xs text-muted-foreground">Current: {awsLocationMapName}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Region</label>
                <Input value={newRegion} onChange={(e) => setNewRegion(e.target.value)} placeholder={awsLocationRegion || 'e.g. ap-south-1'} className="bg-muted/30 font-mono text-sm" />
                {awsLocationRegion && !newRegion && <p className="text-xs text-muted-foreground">Current: {awsLocationRegion}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Place Index</label>
                <Input value={newPlaceIndex} onChange={(e) => setNewPlaceIndex(e.target.value)} placeholder={awsLocationPlaceIndex || 'e.g. HRMSPlaceIndex'} className="bg-muted/30 font-mono text-sm" />
                {awsLocationPlaceIndex && !newPlaceIndex && <p className="text-xs text-muted-foreground">Current: {awsLocationPlaceIndex}</p>}
              </div>
            </div>

            <InfoBanner variant="info" icon={Key}>
              These values are stored as Cloud secrets. Update them via Lovable Cloud settings for backend changes to take effect.
            </InfoBanner>

            <div className="flex items-center justify-between">
              <Button onClick={saveMapConfig} disabled={savingAwsLocation || (!newMapName && !newRegion && !newPlaceIndex)} className="gap-2">
                {savingAwsLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Configuration
              </Button>
              <Button variant="outline" onClick={testAwsLocation} disabled={testingAwsLocation} className="gap-2">
                {testingAwsLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : awsLocationTestResult === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <MapPin className="w-4 h-4" />}
                Test Connection
              </Button>
            </div>
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════ */}
        {/* DATA MANAGEMENT */}
        {/* ═══════════════════════════════════════════ */}
        <DataExportImport />

        {/* ═══════════════════════════════════════════ */}
        {/* DANGER ZONE */}
        {/* ═══════════════════════════════════════════ */}
        <SettingsSection
          title="Danger Zone"
          description="Irreversible actions — proceed with caution"
          icon={Trash2}
          className="border-destructive/40"
        >
          <div className="rounded-lg border-2 border-dashed border-destructive/20 bg-destructive/5 p-5">
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete all attendance records, leave requests, face data, audit logs, invite history, and notifications. User accounts and companies remain intact.
            </p>
            <Button variant="destructive" onClick={() => setClearDataStep(1)} disabled={clearingData} className="gap-2">
              <Trash2 className="w-4 h-4" />
              Clear All Test Data
            </Button>
          </div>
        </SettingsSection>
      </main>

      {/* Confirmation Dialogs */}
      <AlertDialog open={clearDataStep === 1} onOpenChange={(o) => !o && setClearDataStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" />Clear All Test Data?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete all attendance records, leave requests, face data, audit logs, and other test data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setClearDataStep(2)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearDataStep === 2} onOpenChange={(o) => !o && setClearDataStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" />Are you ABSOLUTELY sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearData} disabled={clearingData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {clearingData ? 'Clearing…' : 'Yes, Clear Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
