import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Settings,
  Mail,
  ScanFace,
  Globe,
  MapPin,
  Camera,
  Timer,
  Save,
  CheckCircle2,
  Eye,
  EyeOff,
  Phone,
  MessageSquare,
  PlayCircle,
  Loader2,
  XCircle,
  Smartphone,
  Trash2,
  AlertTriangle,
  Shield,
  Key,
  Calendar,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AppLayout from '@/components/AppLayout';
import DataExportImport from '@/components/DataExportImport';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function DeveloperSettings() {
  const { isDeveloper, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
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
  
  const [emailServiceId, setEmailServiceId] = useState('');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [emailPublicKey, setEmailPublicKey] = useState('');
  const [showEmailKeys, setShowEmailKeys] = useState(false);
  const [emailConfigSaving, setEmailConfigSaving] = useState(false);
  
  const [phoneOtpEnabled, setPhoneOtpEnabled] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [showTwilioKeys, setShowTwilioKeys] = useState(false);
  const [twilioConfigSaving, setTwilioConfigSaving] = useState(false);
  const [twilioBackendConfigured, setTwilioBackendConfigured] = useState(false);
  
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(true);
  const [resendApiKey, setResendApiKey] = useState('');
  const [showResendKey, setShowResendKey] = useState(false);
  const [resendConfigSaving, setResendConfigSaving] = useState(false);
  const [resendBackendConfigured, setResendBackendConfigured] = useState(false);
  
  const [smsTemplateSignup, setSmsTemplateSignup] = useState('Your AttendanceHub verification code is: {{OTP}}. This code expires in 5 minutes.');
  const [smsTemplateLogin, setSmsTemplateLogin] = useState('Your AttendanceHub login code is: {{OTP}}. This code expires in 5 minutes.');
  const [smsTemplatesSaving, setSmsTemplatesSaving] = useState(false);
  
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [twilioTestResult, setTwilioTestResult] = useState<'success' | 'error' | null>(null);
  const [testingResend, setTestingResend] = useState(false);
  const [resendTestResult, setResendTestResult] = useState<'success' | 'error' | null>(null);
  const [testingEmailJS, setTestingEmailJS] = useState(false);
  const [emailJSTestResult, setEmailJSTestResult] = useState<'success' | 'error' | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');

  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [showAwsKeys, setShowAwsKeys] = useState(false);
  const [awsConfigSaving, setAwsConfigSaving] = useState(false);
  const [awsConfigured, setAwsConfigured] = useState(false);
  const [awsAccessKeyMasked, setAwsAccessKeyMasked] = useState('');
  const [testingAws, setTestingAws] = useState(false);
  const [awsTestResult, setAwsTestResult] = useState<'success' | 'error' | null>(null);

  const [awsLocationMapName, setAwsLocationMapName] = useState('');
  const [awsLocationRegion, setAwsLocationRegion] = useState('ap-south-1');
  const [awsLocationConfigured, setAwsLocationConfigured] = useState(false);
  const [savingAwsLocation, setSavingAwsLocation] = useState(false);
  const [testingAwsLocation, setTestingAwsLocation] = useState(false);
  const [awsLocationTestResult, setAwsLocationTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value');
    
    if (!error && data) {
      data.forEach((setting) => {
        switch (setting.key) {
          case 'face_verification_required':
            setFaceVerificationEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'show_marketing_landing_page':
            setMarketingPageEnabled((setting.value as { enabled: boolean })?.enabled ?? false);
            break;
          case 'gps_tracking_enabled':
            setGpsTrackingEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'photo_capture_enabled':
            setPhotoCaptureEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'leave_management_enabled':
            setLeaveManagementEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'overtime_tracking_enabled':
            setOvertimeTrackingEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'face_verification_threshold':
            setFaceVerificationThreshold((setting.value as { threshold: number })?.threshold ?? 70);
            break;
          case 'emailjs_config': {
            const emailConfig = setting.value as { service_id?: string; template_id?: string; public_key?: string };
            setEmailServiceId(emailConfig?.service_id || '');
            setEmailTemplateId(emailConfig?.template_id || '');
            setEmailPublicKey(emailConfig?.public_key || '');
            break;
          }
          case 'phone_otp_enabled':
            setPhoneOtpEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'email_otp_enabled':
            setEmailOtpEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'resend_config': {
            const resendConfig = setting.value as { api_key?: string };
            const apiKey = resendConfig?.api_key || '';
            setResendApiKey(apiKey === 'configured_via_backend' ? '' : apiKey);
            setResendBackendConfigured(apiKey === 'configured_via_backend' || apiKey === '');
            break;
          }
          case 'sms_templates': {
            const templates = setting.value as { otp_signup?: string; otp_login?: string };
            if (templates?.otp_signup) setSmsTemplateSignup(templates.otp_signup);
            if (templates?.otp_login) setSmsTemplateLogin(templates.otp_login);
            break;
          }
          case 'google_signin_enabled':
            setGoogleSigninEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'password_login_enabled':
            setPasswordLoginEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'oauth_phone_verification_enabled':
            setOauthPhoneVerificationEnabled((setting.value as { enabled: boolean })?.enabled ?? true);
            break;
          case 'app_only_mode_enabled':
            setAppOnlyModeEnabled((setting.value as { enabled: boolean })?.enabled ?? false);
            break;
          case 'testing_mode_enabled':
            setTestingModeEnabled((setting.value as { enabled: boolean })?.enabled ?? false);
            break;
        }
      });
    }
    
    checkTwilioConfig();
    checkAwsConfig();
    checkAwsLocationConfig();
  };

  const checkAwsConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('update-aws-credentials', {
        body: { action: 'get' }
      });
      if (!error && data) {
        setAwsConfigured(data.configured || false);
        setAwsAccessKeyMasked(data.accessKeyMasked || '');
      }
    } catch (err) {
      console.error('Error checking AWS config:', err);
    }
  };

  const testAwsCredentials = async () => {
    setTestingAws(true);
    setAwsTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('update-aws-credentials', {
        body: { action: 'test', accessKeyId: awsAccessKeyId || undefined, secretAccessKey: awsSecretAccessKey || undefined }
      });
      if (error) throw error;
      if (data?.success) {
        setAwsTestResult('success');
        toast({ title: 'Face Verification Test Passed', description: data.message || 'API credentials are valid' });
      } else {
        throw new Error(data?.error || 'Test failed');
      }
    } catch (error: any) {
      setAwsTestResult('error');
      toast({ title: 'Face Verification Test Failed', description: error.message || 'Failed to verify credentials', variant: 'destructive' });
    } finally {
      setTestingAws(false);
    }
  };

  const checkAwsLocationConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('test-aws-location', {
        body: { action: 'get-config' }
      });
      if (!error && data) {
        setAwsLocationConfigured(data.configured || false);
        setAwsLocationMapName(data.mapName || '');
        setAwsLocationRegion(data.region || 'ap-south-1');
      }
    } catch (err) {
      console.error('Error checking map service config:', err);
    }
  };

  const testAwsLocation = async () => {
    setTestingAwsLocation(true);
    setAwsLocationTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-aws-location', { body: { action: 'test' } });
      if (error) throw error;
      if (data?.success) {
        setAwsLocationTestResult('success');
        setAwsLocationConfigured(true);
        toast({ title: 'Map Service Test Passed', description: data.message || 'Map configuration is valid' });
      } else {
        throw new Error(data?.error || 'Test failed');
      }
    } catch (error: any) {
      setAwsLocationTestResult('error');
      toast({ title: 'Map Service Test Failed', description: error.message || 'Failed to verify map configuration', variant: 'destructive' });
    } finally {
      setTestingAwsLocation(false);
    }
  };

  const saveEmailConfig = async () => {
    setEmailConfigSaving(true);
    const { error } = await supabase.from('system_settings').upsert({
      key: 'emailjs_config',
      value: { service_id: emailServiceId, template_id: emailTemplateId, public_key: emailPublicKey }
    }, { onConflict: 'key' });
    toast(error ? { title: 'Error', description: 'Failed to save email configuration', variant: 'destructive' as const } : { title: 'Success', description: 'Email configuration saved successfully' });
    setEmailConfigSaving(false);
  };

  const isEmailConfigured = emailServiceId && emailTemplateId && emailPublicKey;

  const checkTwilioConfig = async () => {
    const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'twilio_config').maybeSingle();
    if (error) { console.error('Error fetching Twilio config:', error); return; }
    if (!data?.value) {
      setTwilioAccountSid(''); setTwilioAuthToken(''); setTwilioPhoneNumber('');
      setTwilioConfigured(false); setTwilioBackendConfigured(true); return;
    }
    const config = data.value as { account_sid?: string; auth_token?: string; phone_number?: string };
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
      key: 'twilio_config',
      value: { account_sid: twilioAccountSid, auth_token: twilioAuthToken, phone_number: twilioPhoneNumber }
    }, { onConflict: 'key' });
    if (error) {
      toast({ title: 'Error', description: 'Failed to save Twilio configuration', variant: 'destructive' });
    } else {
      setTwilioConfigured(!!(twilioAccountSid && twilioAuthToken && twilioPhoneNumber));
      toast({ title: 'Success', description: 'Twilio configuration saved successfully' });
    }
    setTwilioConfigSaving(false);
  };

  const isTwilioConfigured = twilioBackendConfigured || (twilioAccountSid && twilioAuthToken && twilioPhoneNumber);
  const isResendConfigured = resendBackendConfigured || !!resendApiKey;

  const updateSetting = async (key: string, enabled: boolean, setter: (val: boolean) => void, successMessage: string) => {
    setSettingsLoading(true);
    const { error } = await supabase.from('system_settings').upsert({ key, value: { enabled } }, { onConflict: 'key' });
    if (error) {
      toast({ title: 'Error', description: 'Failed to update setting', variant: 'destructive' });
    } else {
      setter(enabled);
      toast({ title: 'Setting Updated', description: successMessage });
    }
    setSettingsLoading(false);
  };

  const togglePhoneOtp = (enabled: boolean) => updateSetting('phone_otp_enabled', enabled, setPhoneOtpEnabled, `Phone OTP verification is now ${enabled ? 'enabled' : 'disabled'}`);
  const toggleEmailOtp = (enabled: boolean) => updateSetting('email_otp_enabled', enabled, setEmailOtpEnabled, `Email OTP verification is now ${enabled ? 'enabled' : 'disabled'}`);
  const toggleFaceVerification = async (enabled: boolean) => {
    setSettingsLoading(true);
    const { error } = await supabase.from('system_settings').update({ value: { enabled } }).eq('key', 'face_verification_required');
    if (error) { toast({ title: 'Error', description: 'Failed to update setting', variant: 'destructive' }); }
    else { setFaceVerificationEnabled(enabled); toast({ title: 'Setting Updated', description: `Face verification is now ${enabled ? 'enabled' : 'disabled'}` }); }
    setSettingsLoading(false);
  };
  const toggleMarketingPage = (enabled: boolean) => updateSetting('show_marketing_landing_page', enabled, setMarketingPageEnabled, enabled ? 'Marketing landing page is now visible' : 'Users will go directly to login');
  const toggleGpsTracking = (enabled: boolean) => updateSetting('gps_tracking_enabled', enabled, setGpsTrackingEnabled, `GPS tracking is now ${enabled ? 'enabled' : 'disabled'}`);
  const togglePhotoCapture = (enabled: boolean) => updateSetting('photo_capture_enabled', enabled, setPhotoCaptureEnabled, `Photo capture is now ${enabled ? 'enabled' : 'disabled'}`);
  const toggleLeaveManagement = (enabled: boolean) => updateSetting('leave_management_enabled', enabled, setLeaveManagementEnabled, `Leave management is now ${enabled ? 'enabled' : 'disabled'}`);
  const toggleOvertimeTracking = (enabled: boolean) => updateSetting('overtime_tracking_enabled', enabled, setOvertimeTrackingEnabled, `Overtime tracking is now ${enabled ? 'enabled' : 'disabled'}`);
  const toggleGoogleSignin = (enabled: boolean) => updateSetting('google_signin_enabled', enabled, setGoogleSigninEnabled, `Google Sign-in is now ${enabled ? 'enabled' : 'disabled'}`);
  const togglePasswordLogin = (enabled: boolean) => updateSetting('password_login_enabled', enabled, setPasswordLoginEnabled, `Password login is now ${enabled ? 'enabled' : 'disabled'}`);
  const toggleOauthPhoneVerification = (enabled: boolean) => updateSetting('oauth_phone_verification_enabled', enabled, setOauthPhoneVerificationEnabled, `OAuth + Phone Verification is now ${enabled ? 'enabled' : 'disabled'}`);
  const toggleAppOnlyMode = (enabled: boolean) => updateSetting('app_only_mode_enabled', enabled, setAppOnlyModeEnabled, enabled ? 'App-only mode enabled.' : 'App-only mode disabled.');
  const toggleTestingMode = (enabled: boolean) => updateSetting('testing_mode_enabled', enabled, setTestingModeEnabled, enabled ? 'Testing mode ON' : 'Testing mode OFF');

  const saveFaceThreshold = async (threshold: number) => {
    setSettingsLoading(true);
    const { error } = await supabase.from('system_settings').upsert({ key: 'face_verification_threshold', value: { threshold } }, { onConflict: 'key' });
    if (error) { toast({ title: 'Error', description: 'Failed to update threshold', variant: 'destructive' }); }
    else { setFaceVerificationThreshold(threshold); toast({ title: 'Setting Updated', description: `Face verification threshold set to ${threshold}%` }); }
    setSettingsLoading(false);
  };

  const saveResendConfig = async () => {
    setResendConfigSaving(true);
    const { error } = await supabase.from('system_settings').upsert({ key: 'resend_config', value: { api_key: resendApiKey } }, { onConflict: 'key' });
    toast(error ? { title: 'Error', description: 'Failed to save Resend configuration', variant: 'destructive' as const } : { title: 'Success', description: 'Resend API configuration saved successfully' });
    setResendConfigSaving(false);
  };

  const saveSmsTemplates = async () => {
    setSmsTemplatesSaving(true);
    const { error } = await supabase.from('system_settings').upsert({ key: 'sms_templates', value: { otp_signup: smsTemplateSignup, otp_login: smsTemplateLogin } }, { onConflict: 'key' });
    toast(error ? { title: 'Error', description: 'Failed to save SMS templates', variant: 'destructive' as const } : { title: 'Success', description: 'SMS templates saved successfully' });
    setSmsTemplatesSaving(false);
  };

  const testTwilioCredentials = async () => {
    if (!testPhone) { toast({ title: 'Phone Required', description: 'Please enter a phone number to test SMS delivery', variant: 'destructive' }); return; }
    setTestingTwilio(true); setTwilioTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', { body: { phone: testPhone, type: 'login' } });
      if (error) throw error;
      if (data?.success) { setTwilioTestResult('success'); toast({ title: 'Twilio Test Passed', description: 'SMS sent successfully!' }); }
      else throw new Error(data?.message || 'Failed to send SMS');
    } catch (error: any) {
      setTwilioTestResult('error');
      toast({ title: 'Twilio Test Failed', description: error.message || 'Failed to send test SMS', variant: 'destructive' });
    } finally { setTestingTwilio(false); }
  };

  const testResendCredentials = async () => {
    if (!testEmail) { toast({ title: 'Email Required', description: 'Please enter an email address to test email delivery', variant: 'destructive' }); return; }
    setTestingResend(true); setResendTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-otp', { body: { email: testEmail, type: 'verification' } });
      if (error) throw error;
      if (data?.success) { setResendTestResult('success'); toast({ title: 'Resend Test Passed', description: 'Email sent successfully!' }); }
      else throw new Error(data?.message || data?.error || 'Failed to send email');
    } catch (error: any) {
      setResendTestResult('error');
      toast({ title: 'Resend Test Failed', description: error.message || 'Failed to send test email', variant: 'destructive' });
    } finally { setTestingResend(false); }
  };

  const testEmailJSCredentials = async () => {
    if (!emailServiceId || !emailTemplateId || !emailPublicKey) { toast({ title: 'Configuration Required', description: 'Please fill in all EmailJS credentials first', variant: 'destructive' }); return; }
    if (!testEmail) { toast({ title: 'Email Required', description: 'Please enter an email address to test', variant: 'destructive' }); return; }
    setTestingEmailJS(true); setEmailJSTestResult(null);
    try {
      const emailjs = await import('@emailjs/browser');
      await emailjs.send(emailServiceId, emailTemplateId, {
        to_email: testEmail, to_name: 'Test User', leave_type: 'Test',
        start_date: new Date().toLocaleDateString(), end_date: new Date().toLocaleDateString(),
        status: 'Approved', admin_notes: 'This is a test email from developer settings.',
      }, emailPublicKey);
      setEmailJSTestResult('success');
      toast({ title: 'EmailJS Test Passed', description: 'Email sent successfully!' });
    } catch (error: any) {
      setEmailJSTestResult('error');
      toast({ title: 'EmailJS Test Failed', description: error.message || 'Failed to send test email', variant: 'destructive' });
    } finally { setTestingEmailJS(false); }
  };

  const handleClearData = async () => {
    setClearingData(true);
    try {
      const res = await supabase.functions.invoke('clear-test-data', { body: { action: 'clear_all_data' } });
      if (res.error) throw res.error;
      toast({ title: 'Data Cleared', description: 'All test data has been removed successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to clear data', variant: 'destructive' });
    } finally { setClearingData(false); setClearDataStep(0); }
  };

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        <PageHeader
          title="System Settings"
          description="Configure system-wide settings and integrations"
          icon={<Settings className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
        />

        {/* Email Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5" />
              Email Notifications (EmailJS)
            </CardTitle>
            <CardDescription>
              Configure EmailJS to send email notifications. Get credentials from <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">emailjs.com</a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="service-id">Service ID</Label>
                <Input id="service-id" type={showEmailKeys ? 'text' : 'password'} placeholder="service_xxxxxxx" value={emailServiceId} onChange={(e) => setEmailServiceId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-id">Template ID</Label>
                <Input id="template-id" type={showEmailKeys ? 'text' : 'password'} placeholder="template_xxxxxxx" value={emailTemplateId} onChange={(e) => setEmailTemplateId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="public-key">Public Key</Label>
                <Input id="public-key" type={showEmailKeys ? 'text' : 'password'} placeholder="Your public key" value={emailPublicKey} onChange={(e) => setEmailPublicKey(e.target.value)} />
              </div>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
              <Label className="text-sm font-medium">Test EmailJS Configuration</Label>
              <div className="flex gap-2">
                <Input type="email" placeholder="Enter test email address" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="flex-1" />
                <Button variant="outline" onClick={testEmailJSCredentials} disabled={testingEmailJS || !isEmailConfigured}>
                  {testingEmailJS ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : emailJSTestResult === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> : emailJSTestResult === 'error' ? <XCircle className="w-4 h-4 mr-2 text-destructive" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                  Test
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setShowEmailKeys(!showEmailKeys)}>
                {showEmailKeys ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showEmailKeys ? 'Hide Keys' : 'Show Keys'}
              </Button>
              <Button onClick={saveEmailConfig} disabled={emailConfigSaving}>
                <Save className="w-4 h-4 mr-2" />
                {emailConfigSaving ? 'Saving...' : 'Save Email Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email OTP Configuration */}
        <Card className={emailOtpEnabled ? 'border-success/50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Mail className="w-5 h-5" />Email OTP Configuration</CardTitle>
            <CardDescription>Configure email service for OTP verification. <strong>EmailJS is used if configured, otherwise Resend is used as fallback.</strong></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label className="font-medium flex items-center gap-2"><Mail className="w-4 h-4" />Enable Email OTP Verification</Label>
                <p className="text-sm text-muted-foreground">When enabled, users can verify via email OTP during signup/login</p>
              </div>
              <Switch checked={emailOtpEnabled} onCheckedChange={toggleEmailOtp} disabled={settingsLoading} />
            </div>
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-blue-600">Email Service Priority</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>1st Priority:</strong> EmailJS (if configured above)<br />
                    <strong>2nd Priority:</strong> Resend (fallback)
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Current: {isEmailConfigured ? '✅ EmailJS will be used' : (isResendConfigured ? '⚠️ Resend will be used (fallback)' : '❌ No email service configured')}
                  </p>
                </div>
              </div>
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">Resend API Key (Fallback Option)</Label>
              <div className="flex gap-2">
                <Input id="resend-key" type={showResendKey ? 'text' : 'password'} placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={resendApiKey} onChange={(e) => setResendApiKey(e.target.value)} className="flex-1" />
                <Button variant="ghost" size="icon" onClick={() => setShowResendKey(!showResendKey)}>
                  {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button onClick={saveResendConfig} disabled={resendConfigSaving} size="sm"><Save className="w-4 h-4 mr-1" />{resendConfigSaving ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
              <Label className="text-sm font-medium">Test Email OTP Configuration</Label>
              <div className="flex gap-2">
                <Input type="email" placeholder="Enter test email address" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="flex-1" />
                <Button variant="outline" onClick={testResendCredentials} disabled={testingResend || (!isEmailConfigured && !isResendConfigured && !resendBackendConfigured)}>
                  {testingResend ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : resendTestResult === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> : resendTestResult === 'error' ? <XCircle className="w-4 h-4 mr-2 text-destructive" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                  Test Email OTP
                </Button>
              </div>
            </div>
            {resendBackendConfigured && !isEmailConfigured && (
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <div className="flex items-start gap-3"><Key className="w-5 h-5 text-amber-500 mt-0.5" /><div><p className="font-medium text-sm text-amber-600">Resend Backend Secret Configured</p><p className="text-xs text-muted-foreground mt-1">Configure EmailJS above for free unlimited emails without domain verification.</p></div></div>
              </div>
            )}
            {isEmailConfigured && (
              <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                <div className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-success mt-0.5" /><div><p className="font-medium text-sm text-success">EmailJS Configured ✓</p><p className="text-xs text-muted-foreground mt-1">Email OTP will be sent via EmailJS.</p></div></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Twilio SMS */}
        <Card className={phoneOtpEnabled ? 'border-success/50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><MessageSquare className="w-5 h-5" />Twilio SMS (Phone OTP)</CardTitle>
            <CardDescription>Configure Twilio for phone verification. Get credentials from <a href="https://www.twilio.com/console" target="_blank" rel="noopener noreferrer" className="text-primary underline">twilio.com/console</a></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label className="font-medium flex items-center gap-2"><Phone className="w-4 h-4" />Enable Phone OTP Verification</Label>
                <p className="text-sm text-muted-foreground">When enabled, users can verify via phone OTP during signup/login</p>
              </div>
              <Switch checked={phoneOtpEnabled} onCheckedChange={togglePhoneOtp} disabled={settingsLoading} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="twilio-sid">Account SID</Label><Input id="twilio-sid" type={showTwilioKeys ? 'text' : 'password'} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={twilioAccountSid} onChange={(e) => setTwilioAccountSid(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="twilio-token">Auth Token</Label><Input id="twilio-token" type={showTwilioKeys ? 'text' : 'password'} placeholder="Your auth token" value={twilioAuthToken} onChange={(e) => setTwilioAuthToken(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="twilio-phone">Phone Number</Label><Input id="twilio-phone" type={showTwilioKeys ? 'text' : 'password'} placeholder="+1234567890" value={twilioPhoneNumber} onChange={(e) => setTwilioPhoneNumber(e.target.value)} /></div>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
              <Label className="text-sm font-medium">Test Twilio Configuration</Label>
              <div className="flex gap-2">
                <Input type="tel" placeholder="Enter test phone number (+1234567890)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className="flex-1" />
                <Button variant="outline" onClick={testTwilioCredentials} disabled={testingTwilio || (!isTwilioConfigured && !twilioBackendConfigured)}>
                  {testingTwilio ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : twilioTestResult === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> : twilioTestResult === 'error' ? <XCircle className="w-4 h-4 mr-2 text-destructive" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                  Test
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setShowTwilioKeys(!showTwilioKeys)}>
                {showTwilioKeys ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showTwilioKeys ? 'Hide Keys' : 'Show Keys'}
              </Button>
              <Button onClick={saveTwilioConfig} disabled={twilioConfigSaving}><Save className="w-4 h-4 mr-2" />{twilioConfigSaving ? 'Saving...' : 'Save Twilio Configuration'}</Button>
            </div>
            {twilioBackendConfigured && (
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30"><div className="flex items-start gap-3"><Key className="w-5 h-5 text-blue-500 mt-0.5" /><div><p className="font-medium text-sm text-blue-600">Backend Secrets Configured</p><p className="text-xs text-muted-foreground mt-1">TWILIO credentials set in backend secrets.</p></div></div></div>
            )}
          </CardContent>
        </Card>

        {/* SMS Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><MessageSquare className="w-5 h-5" />SMS Message Templates</CardTitle>
            <CardDescription>Customize OTP messages. Use {'{{OTP}}'} as placeholder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sms-signup">Signup OTP Template</Label>
              <textarea id="sms-signup" value={smsTemplateSignup} onChange={(e) => setSmsTemplateSignup(e.target.value)} className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-login">Login OTP Template</Label>
              <textarea id="sms-login" value={smsTemplateLogin} onChange={(e) => setSmsTemplateLogin(e.target.value)} className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background" />
            </div>
            <Button onClick={saveSmsTemplates} disabled={smsTemplatesSaving}><Save className="w-4 h-4 mr-2" />{smsTemplatesSaving ? 'Saving...' : 'Save Templates'}</Button>
          </CardContent>
        </Card>

        {/* Landing Page Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Globe className="w-5 h-5" />Landing Page Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="marketing-page" className="font-medium">Show Marketing Landing Page</Label>
                <p className="text-sm text-muted-foreground">When disabled, visitors go directly to login.</p>
              </div>
              <Switch id="marketing-page" checked={marketingPageEnabled} onCheckedChange={toggleMarketingPage} disabled={settingsLoading} />
            </div>
          </CardContent>
        </Card>

        {/* App-Only Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Smartphone className="w-5 h-5" />PWA / App-Only Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="app-only-mode" className="font-medium">Require App Installation</Label>
                <p className="text-sm text-muted-foreground">When enabled, users must install the PWA.</p>
              </div>
              <Switch id="app-only-mode" checked={appOnlyModeEnabled} onCheckedChange={toggleAppOnlyMode} disabled={settingsLoading} />
            </div>
          </CardContent>
        </Card>

        {/* Authentication Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Shield className="w-5 h-5" />Authentication Settings</CardTitle>
            <CardDescription>Control login methods and authentication options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 rounded-lg border-2 border-dashed border-warning/50 bg-warning/5">
              <div className="space-y-1">
                <Label htmlFor="testing-mode" className="font-medium flex items-center gap-2">🧪 Testing Mode</Label>
                <p className="text-sm text-muted-foreground">Bypass OTP verification for faster testing.</p>
              </div>
              <Switch id="testing-mode" checked={testingModeEnabled} onCheckedChange={toggleTestingMode} disabled={settingsLoading} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label htmlFor="password-login" className="font-medium">Email + Password Login</Label><p className="text-sm text-muted-foreground">Allow users to sign in with email and password.</p></div>
              <Switch id="password-login" checked={passwordLoginEnabled} onCheckedChange={togglePasswordLogin} disabled={settingsLoading} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label htmlFor="google-signin" className="font-medium">Google Sign-in</Label><p className="text-sm text-muted-foreground">Allow users to sign in with Google.</p></div>
              <Switch id="google-signin" checked={googleSigninEnabled} onCheckedChange={toggleGoogleSignin} disabled={settingsLoading} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label htmlFor="phone-otp-auth" className="font-medium">Phone OTP Login</Label><p className="text-sm text-muted-foreground">Allow sign in/up using phone OTP (requires Twilio).</p></div>
              <Switch id="phone-otp-auth" checked={phoneOtpEnabled} onCheckedChange={togglePhoneOtp} disabled={settingsLoading} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label htmlFor="email-otp-auth" className="font-medium">Email OTP Login</Label><p className="text-sm text-muted-foreground">Allow sign in/up using email OTP.</p></div>
              <Switch id="email-otp-auth" checked={emailOtpEnabled} onCheckedChange={toggleEmailOtp} disabled={settingsLoading} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label htmlFor="oauth-phone-verify" className="font-medium">OAuth + Phone Verification</Label><p className="text-sm text-muted-foreground">Require phone OTP after Google sign-in.</p></div>
              <Switch id="oauth-phone-verify" checked={oauthPhoneVerificationEnabled} onCheckedChange={toggleOauthPhoneVerification} disabled={settingsLoading} />
            </div>
          </CardContent>
        </Card>

        {/* Attendance Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><ScanFace className="w-5 h-5" />Attendance Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label htmlFor="face-verification" className="font-medium">Face Verification</Label><p className="text-sm text-muted-foreground">Require face verification during attendance</p></div>
              <Switch id="face-verification" checked={faceVerificationEnabled} onCheckedChange={toggleFaceVerification} disabled={settingsLoading} />
            </div>
            {faceVerificationEnabled && (
              <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                <div className="space-y-1">
                  <Label className="font-medium flex items-center gap-2"><ScanFace className="w-4 h-4" />Confidence Threshold: <span className="text-primary font-bold">{faceVerificationThreshold}%</span></Label>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">50%</span>
                  <input type="range" min="50" max="95" step="5" value={faceVerificationThreshold} onChange={(e) => setFaceVerificationThreshold(Number(e.target.value))} className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" disabled={settingsLoading} />
                  <span className="text-xs text-muted-foreground">95%</span>
                  <Button size="sm" onClick={() => saveFaceThreshold(faceVerificationThreshold)} disabled={settingsLoading}><Save className="w-4 h-4 mr-1" />Save</Button>
                </div>
                <div className="flex gap-2 mt-2">
                  {[60, 70, 80, 90].map((val) => (
                    <Button key={val} variant={faceVerificationThreshold === val ? "default" : "outline"} size="sm" onClick={() => { setFaceVerificationThreshold(val); saveFaceThreshold(val); }} disabled={settingsLoading}>{val}%</Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label className="font-medium flex items-center gap-2"><MapPin className="w-4 h-4" />GPS Location Tracking</Label><p className="text-sm text-muted-foreground">Capture location during check-in/out</p></div>
              <Switch checked={gpsTrackingEnabled} onCheckedChange={toggleGpsTracking} disabled={settingsLoading} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label className="font-medium flex items-center gap-2"><Camera className="w-4 h-4" />Photo Capture</Label><p className="text-sm text-muted-foreground">Require photo during check-in/out</p></div>
              <Switch checked={photoCaptureEnabled} onCheckedChange={togglePhotoCapture} disabled={settingsLoading} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label className="font-medium flex items-center gap-2"><Timer className="w-4 h-4" />Overtime Tracking</Label><p className="text-sm text-muted-foreground">Track overtime hours</p></div>
              <Switch checked={overtimeTrackingEnabled} onCheckedChange={toggleOvertimeTracking} disabled={settingsLoading} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1"><Label className="font-medium flex items-center gap-2"><Calendar className="w-4 h-4" />Leave Management</Label><p className="text-sm text-muted-foreground">Enable leave request and approval</p></div>
              <Switch checked={leaveManagementEnabled} onCheckedChange={toggleLeaveManagement} disabled={settingsLoading} />
            </div>
          </CardContent>
        </Card>

        {/* Face Verification Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><ScanFace className="w-5 h-5" />Face Verification Configuration</CardTitle>
            <CardDescription>Configure credentials for biometric face verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {awsConfigured && (
              <div className="p-4 bg-success/10 rounded-lg border border-success/30"><div className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-success mt-0.5" /><div><p className="font-medium text-sm text-success">Face Verification Configured</p><p className="text-xs text-muted-foreground mt-1">Access Key: {awsAccessKeyMasked || 'Configured via backend secrets'}</p></div></div></div>
            )}
            <div className="p-4 bg-info/10 rounded-lg border border-info/30"><div className="flex items-start gap-3"><Key className="w-5 h-5 text-info mt-0.5" /><div><p className="font-medium text-sm text-info">Secrets Management</p><p className="text-xs text-muted-foreground mt-1">Credentials are stored as backend secrets. Test your current configuration below.</p></div></div></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Access Key ID (for testing)</Label><Input type={showAwsKeys ? 'text' : 'password'} placeholder="Enter new Access Key ID" value={awsAccessKeyId} onChange={(e) => setAwsAccessKeyId(e.target.value)} /></div>
              <div className="space-y-2"><Label>Secret Access Key (for testing)</Label><Input type={showAwsKeys ? 'text' : 'password'} placeholder="Enter new Secret Access Key" value={awsSecretAccessKey} onChange={(e) => setAwsSecretAccessKey(e.target.value)} /></div>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setShowAwsKeys(!showAwsKeys)}>{showAwsKeys ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}{showAwsKeys ? 'Hide Keys' : 'Show Keys'}</Button>
              <Button variant="outline" onClick={testAwsCredentials} disabled={testingAws}>
                {testingAws ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : awsTestResult === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> : awsTestResult === 'error' ? <XCircle className="w-4 h-4 mr-2 text-destructive" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                {awsAccessKeyId ? 'Test New Credentials' : 'Test Current Config'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Map Service Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="w-5 h-5" />Map Service Configuration</CardTitle>
            <CardDescription>Configure map service for live employee tracking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {awsLocationConfigured && (
              <div className="p-4 bg-success/10 rounded-lg border border-success/30"><div className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-success mt-0.5" /><div><p className="font-medium text-sm text-success">Map Service Configured</p><p className="text-xs text-muted-foreground mt-1">Map Name: {awsLocationMapName || 'Configured via backend secrets'}</p></div></div></div>
            )}
            <div className="space-y-4">
              <div className="space-y-2"><Label>Current Map Name</Label><Input value={awsLocationMapName} disabled placeholder="Not configured" className="bg-muted" /></div>
              <div className="space-y-2"><Label>Region</Label><Input value={awsLocationRegion} disabled className="bg-muted" /></div>
            </div>
            <div className="flex items-center justify-end">
              <Button variant="outline" onClick={testAwsLocation} disabled={testingAwsLocation}>
                {testingAwsLocation ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : awsLocationTestResult === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> : awsLocationTestResult === 'error' ? <XCircle className="w-4 h-4 mr-2 text-destructive" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                Test Map Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Backup */}
        <DataExportImport />

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-destructive"><Trash2 className="w-5 h-5" />Danger Zone</CardTitle>
            <CardDescription>Clear all test data before publishing to production</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg border-2 border-dashed border-destructive/30 bg-destructive/5">
              <p className="text-sm text-muted-foreground mb-4">This will delete all attendance records, leave requests, face data, audit logs, invite history, and notifications. User accounts and companies will remain intact.</p>
              <Button variant="destructive" onClick={() => setClearDataStep(1)} disabled={clearingData}><Trash2 className="w-4 h-4 mr-2" />Clear All Test Data</Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={clearDataStep === 1} onOpenChange={(o) => !o && setClearDataStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" />Clear All Test Data?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete all attendance records, leave requests, face data, audit logs, and other test data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setClearDataStep(2)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Continue</AlertDialogAction>
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
              {clearingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {clearingData ? 'Clearing...' : 'Delete Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
