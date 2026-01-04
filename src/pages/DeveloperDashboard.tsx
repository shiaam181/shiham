import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Code,
  LogOut,
  Users,
  Calendar,
  ChevronRight,
  User,
  Shield,
  Settings,
  Database,
  Key,
  Bell,
  BarChart3,
  Clock,
  Building2,
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
  XCircle
} from 'lucide-react';
import RoleManagement from '@/components/RoleManagement';
import MobileBottomNav from '@/components/MobileBottomNav';
import NotificationBell from '@/components/NotificationBell';
import RoleBasedHeader from '@/components/RoleBasedHeader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function DeveloperDashboard() {
  const { profile, isDeveloper, signOut, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [faceVerificationEnabled, setFaceVerificationEnabled] = useState(true);
  const [marketingPageEnabled, setMarketingPageEnabled] = useState(false);
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(true);
  const [photoCaptureEnabled, setPhotoCaptureEnabled] = useState(true);
  const [leaveManagementEnabled, setLeaveManagementEnabled] = useState(true);
  const [overtimeTrackingEnabled, setOvertimeTrackingEnabled] = useState(true);
  const [faceVerificationThreshold, setFaceVerificationThreshold] = useState(70);
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  // EmailJS configuration state
  const [emailServiceId, setEmailServiceId] = useState('');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [emailPublicKey, setEmailPublicKey] = useState('');
  const [showEmailKeys, setShowEmailKeys] = useState(false);
  const [emailConfigSaving, setEmailConfigSaving] = useState(false);
  
  // Twilio SMS configuration state (Phone OTP)
  const [phoneOtpEnabled, setPhoneOtpEnabled] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [showTwilioKeys, setShowTwilioKeys] = useState(false);
  const [twilioConfigSaving, setTwilioConfigSaving] = useState(false);
  const [twilioBackendConfigured, setTwilioBackendConfigured] = useState(false);
  
  // Resend Email OTP configuration state
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(true);
  const [resendApiKey, setResendApiKey] = useState('');
  const [showResendKey, setShowResendKey] = useState(false);
  const [resendConfigSaving, setResendConfigSaving] = useState(false);
  const [resendBackendConfigured, setResendBackendConfigured] = useState(false);
  
  // SMS Templates state
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
        }
      });
    }
    
    // Check if Twilio is configured by checking if the edge function works
    checkTwilioConfig();
  };

  const saveEmailConfig = async () => {
    setEmailConfigSaving(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'emailjs_config',
        value: {
          service_id: emailServiceId,
          template_id: emailTemplateId,
          public_key: emailPublicKey
        }
      }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to save email configuration',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Email configuration saved successfully',
      });
    }
    setEmailConfigSaving(false);
  };

  const isEmailConfigured = emailServiceId && emailTemplateId && emailPublicKey;

  const checkTwilioConfig = async () => {
    // Check if Twilio config exists in system_settings
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'twilio_config')
      .maybeSingle();

    if (error) {
      console.error('Error fetching Twilio config:', error);
      return;
    }

    if (!data?.value) {
      setTwilioAccountSid('');
      setTwilioAuthToken('');
      setTwilioPhoneNumber('');
      setTwilioConfigured(false);
      // Check if backend secrets might be configured
      setTwilioBackendConfigured(true);
      return;
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
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'twilio_config',
        value: {
          account_sid: twilioAccountSid,
          auth_token: twilioAuthToken,
          phone_number: twilioPhoneNumber
        }
      }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to save Twilio configuration',
        variant: 'destructive',
      });
    } else {
      setTwilioConfigured(!!(twilioAccountSid && twilioAuthToken && twilioPhoneNumber));
      toast({
        title: 'Success',
        description: 'Twilio configuration saved successfully',
      });
    }
    setTwilioConfigSaving(false);
  };

  const isTwilioConfigured = twilioBackendConfigured || (twilioAccountSid && twilioAuthToken && twilioPhoneNumber);
  const isResendConfigured = resendBackendConfigured || !!resendApiKey;

  const togglePhoneOtp = async (enabled: boolean) => {
    setSettingsLoading(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'phone_otp_enabled', value: { enabled } }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update Phone OTP setting',
        variant: 'destructive',
      });
    } else {
      setPhoneOtpEnabled(enabled);
      toast({
        title: 'Setting Updated',
        description: `Phone OTP verification is now ${enabled ? 'enabled' : 'disabled'}`,
      });
    }
    setSettingsLoading(false);
  };

  const toggleEmailOtp = async (enabled: boolean) => {
    setSettingsLoading(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'email_otp_enabled', value: { enabled } }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update Email OTP setting',
        variant: 'destructive',
      });
    } else {
      setEmailOtpEnabled(enabled);
      toast({
        title: 'Setting Updated',
        description: `Email OTP verification is now ${enabled ? 'enabled' : 'disabled'}`,
      });
    }
    setSettingsLoading(false);
  };

  const saveResendConfig = async () => {
    setResendConfigSaving(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'resend_config',
        value: { api_key: resendApiKey }
      }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to save Resend configuration',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Resend API configuration saved successfully',
      });
    }
    setResendConfigSaving(false);
  };

  const saveSmsTemplates = async () => {
    setSmsTemplatesSaving(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ 
        key: 'sms_templates', 
        value: { 
          otp_signup: smsTemplateSignup,
          otp_login: smsTemplateLogin
        } 
      }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to save SMS templates',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'SMS templates saved successfully',
      });
    }
    setSmsTemplatesSaving(false);
  };

  // Test Twilio credentials
  const testTwilioCredentials = async () => {
    if (!testPhone) {
      toast({
        title: 'Phone Required',
        description: 'Please enter a phone number to test SMS delivery',
        variant: 'destructive',
      });
      return;
    }
    
    setTestingTwilio(true);
    setTwilioTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: testPhone, type: 'login' }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setTwilioTestResult('success');
        toast({
          title: 'Twilio Test Passed',
          description: 'SMS sent successfully! Check your phone for the test OTP.',
        });
      } else {
        throw new Error(data?.message || 'Failed to send SMS');
      }
    } catch (error: any) {
      setTwilioTestResult('error');
      toast({
        title: 'Twilio Test Failed',
        description: error.message || 'Failed to send test SMS',
        variant: 'destructive',
      });
    } finally {
      setTestingTwilio(false);
    }
  };

  // Test Resend credentials
  const testResendCredentials = async () => {
    if (!testEmail) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address to test email delivery',
        variant: 'destructive',
      });
      return;
    }
    
    setTestingResend(true);
    setResendTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-email-otp', {
        body: { email: testEmail, type: 'verification' }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setResendTestResult('success');
        toast({
          title: 'Resend Test Passed',
          description: 'Email sent successfully! Check your inbox for the test OTP.',
        });
      } else {
        throw new Error(data?.message || data?.error || 'Failed to send email');
      }
    } catch (error: any) {
      setResendTestResult('error');
      toast({
        title: 'Resend Test Failed',
        description: error.message || 'Failed to send test email',
        variant: 'destructive',
      });
    } finally {
      setTestingResend(false);
    }
  };

  // Test EmailJS credentials
  const testEmailJSCredentials = async () => {
    if (!emailServiceId || !emailTemplateId || !emailPublicKey) {
      toast({
        title: 'Configuration Required',
        description: 'Please fill in all EmailJS credentials first',
        variant: 'destructive',
      });
      return;
    }

    if (!testEmail) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address to test email delivery',
        variant: 'destructive',
      });
      return;
    }
    
    setTestingEmailJS(true);
    setEmailJSTestResult(null);
    
    try {
      // Dynamically import emailjs
      const emailjs = await import('@emailjs/browser');
      
      await emailjs.send(
        emailServiceId,
        emailTemplateId,
        {
          to_email: testEmail,
          to_name: 'Test User',
          leave_type: 'Test',
          start_date: new Date().toLocaleDateString(),
          end_date: new Date().toLocaleDateString(),
          status: 'Approved',
          admin_notes: 'This is a test email from AttendanceHub developer settings.',
        },
        emailPublicKey
      );
      
      setEmailJSTestResult('success');
      toast({
        title: 'EmailJS Test Passed',
        description: 'Email sent successfully! Check your inbox.',
      });
    } catch (error: any) {
      setEmailJSTestResult('error');
      toast({
        title: 'EmailJS Test Failed',
        description: error.message || 'Failed to send test email',
        variant: 'destructive',
      });
    } finally {
      setTestingEmailJS(false);
    }
  };

  const saveFaceThreshold = async (threshold: number) => {
    setSettingsLoading(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'face_verification_threshold', value: { threshold } }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update threshold',
        variant: 'destructive',
      });
    } else {
      setFaceVerificationThreshold(threshold);
      toast({
        title: 'Setting Updated',
        description: `Face verification threshold set to ${threshold}%`,
      });
    }
    setSettingsLoading(false);
  };

  const toggleFaceVerification = async (enabled: boolean) => {
    setSettingsLoading(true);
    const { error } = await supabase
      .from('system_settings')
      .update({ value: { enabled } })
      .eq('key', 'face_verification_required');
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update setting',
        variant: 'destructive',
      });
    } else {
      setFaceVerificationEnabled(enabled);
      toast({
        title: 'Setting Updated',
        description: `Face verification is now ${enabled ? 'enabled' : 'disabled'}`,
      });
    }
    setSettingsLoading(false);
  };

  const toggleMarketingPage = async (enabled: boolean) => {
    await updateSetting('show_marketing_landing_page', enabled, setMarketingPageEnabled, 
      enabled ? 'Marketing landing page is now visible' : 'Users will go directly to login');
  };

  const updateSetting = async (
    key: string, 
    enabled: boolean, 
    setter: (val: boolean) => void,
    successMessage: string
  ) => {
    setSettingsLoading(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key, value: { enabled } }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update setting',
        variant: 'destructive',
      });
    } else {
      setter(enabled);
      toast({ title: 'Setting Updated', description: successMessage });
    }
    setSettingsLoading(false);
  };

  const toggleGpsTracking = (enabled: boolean) => 
    updateSetting('gps_tracking_enabled', enabled, setGpsTrackingEnabled, 
      `GPS tracking is now ${enabled ? 'enabled' : 'disabled'}`);

  const togglePhotoCapture = (enabled: boolean) => 
    updateSetting('photo_capture_enabled', enabled, setPhotoCaptureEnabled, 
      `Photo capture is now ${enabled ? 'enabled' : 'disabled'}`);

  const toggleLeaveManagement = (enabled: boolean) => 
    updateSetting('leave_management_enabled', enabled, setLeaveManagementEnabled, 
      `Leave management is now ${enabled ? 'enabled' : 'disabled'}`);

  const toggleOvertimeTracking = (enabled: boolean) => 
    updateSetting('overtime_tracking_enabled', enabled, setOvertimeTrackingEnabled, 
      `Overtime tracking is now ${enabled ? 'enabled' : 'disabled'}`);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading developer dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isDeveloper) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <RoleBasedHeader currentView="developer" />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="roles">Role Management</TabsTrigger>
            <TabsTrigger value="settings">System Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Code className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Access Level</p>
                    <p className="text-xl font-display font-bold">Developer</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Database className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Database</p>
                    <p className="text-xl font-display font-bold">Connected</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Key className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">API Status</p>
                    <p className="text-xl font-display font-bold">Active</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <Bell className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Notifications</p>
                    <p className="text-xl font-display font-bold">Enabled</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card 
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow border-purple-500/20 hover:border-purple-500/40"
                onClick={() => setActiveTab('roles')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium">Role Management</p>
                    <p className="text-xs text-muted-foreground">Assign admin/developer roles</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </div>
              </Card>
              
              <Card 
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => navigate('/admin/settings', { state: { from: 'developer' } })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Company Settings</p>
                    <p className="text-xs text-muted-foreground">Configure company info</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </div>
              </Card>
              
              <Card 
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => navigate('/admin/shifts', { state: { from: 'developer' } })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                    <Clock className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Shift Management</p>
                    <p className="text-xs text-muted-foreground">Create & assign shifts</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </div>
              </Card>
              
              <Card 
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => navigate('/admin/employees', { state: { from: 'developer' } })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Employee Management</p>
                    <p className="text-xs text-muted-foreground">Add, edit, deactivate</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </div>
              </Card>
              
              <Card 
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => navigate('/admin/holidays', { state: { from: 'developer' } })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning-soft flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium">Holiday Management</p>
                    <p className="text-xs text-muted-foreground">Manage company holidays</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </div>
              </Card>
              
              <Card 
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => navigate('/admin/reports', { state: { from: 'developer' } })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-info-soft flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="font-medium">Reports & Analytics</p>
                    <p className="text-xs text-muted-foreground">Export attendance data</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </div>
              </Card>

              <Card 
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => navigate('/admin/leaves', { state: { from: 'developer' } })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success-soft flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">Leave Requests</p>
                    <p className="text-xs text-muted-foreground">Approve or reject leaves</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </div>
              </Card>

              <Card 
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => navigate('/admin/weekoffs', { state: { from: 'developer' } })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Settings className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Weekly Offs</p>
                    <p className="text-xs text-muted-foreground">Configure week off days</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </div>
              </Card>

              <Card 
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => navigate('/admin')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Admin Dashboard</p>
                    <p className="text-xs text-muted-foreground">View admin panel</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roles">
            <RoleManagement />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  System Configuration
                </CardTitle>
                <CardDescription>
                  Configure system-wide settings and integrations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card 
                    className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                    onClick={() => navigate('/admin/settings', { state: { from: 'developer' } })}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Company Settings</p>
                        <p className="text-xs text-muted-foreground">Name, logo, contact info</p>
                      </div>
                      <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                    </div>
                  </Card>

                  <Card 
                    className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                    onClick={() => navigate('/admin/shifts', { state: { from: 'developer' } })}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                        <Clock className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Shift Configuration</p>
                        <p className="text-xs text-muted-foreground">Work timings, grace period</p>
                      </div>
                      <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                    </div>
                  </Card>

                  <Card 
                    className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                    onClick={() => navigate('/admin/weekoffs', { state: { from: 'developer' } })}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Week Off Configuration</p>
                        <p className="text-xs text-muted-foreground">Global & user-specific week offs</p>
                      </div>
                      <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                    </div>
                  </Card>

                  <Card className={`p-4 ${isEmailConfigured ? 'border-success/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEmailConfigured ? 'bg-success/20' : 'bg-orange-500/20'}`}>
                        {isEmailConfigured ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Mail className="w-5 h-5 text-orange-500" />}
                      </div>
                      <div>
                        <p className="font-medium">Email Configuration</p>
                        <p className="text-xs text-muted-foreground">{isEmailConfigured ? 'EmailJS configured' : 'Configure below'}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Email Configuration Section */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Mail className="w-5 h-5" />
                      Email Notifications (EmailJS)
                    </CardTitle>
                    <CardDescription>
                      Configure EmailJS to send email notifications for leave approvals. Get your credentials from <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">emailjs.com</a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="service-id">Service ID</Label>
                        <Input
                          id="service-id"
                          type={showEmailKeys ? 'text' : 'password'}
                          placeholder="service_xxxxxxx"
                          value={emailServiceId}
                          onChange={(e) => setEmailServiceId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-id">Template ID</Label>
                        <Input
                          id="template-id"
                          type={showEmailKeys ? 'text' : 'password'}
                          placeholder="template_xxxxxxx"
                          value={emailTemplateId}
                          onChange={(e) => setEmailTemplateId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="public-key">Public Key</Label>
                        <Input
                          id="public-key"
                          type={showEmailKeys ? 'text' : 'password'}
                          placeholder="Your public key"
                          value={emailPublicKey}
                          onChange={(e) => setEmailPublicKey(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    {/* Test Section */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
                      <Label className="text-sm font-medium">Test EmailJS Configuration</Label>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="Enter test email address"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={testEmailJSCredentials}
                          disabled={testingEmailJS || !isEmailConfigured}
                        >
                          {testingEmailJS ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : emailJSTestResult === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                          ) : emailJSTestResult === 'error' ? (
                            <XCircle className="w-4 h-4 mr-2 text-destructive" />
                          ) : (
                            <PlayCircle className="w-4 h-4 mr-2" />
                          )}
                          Test
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEmailKeys(!showEmailKeys)}
                      >
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

                {/* Resend Email OTP Configuration */}
                <Card className={`mt-6 ${emailOtpEnabled ? 'border-success/50' : ''}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Mail className="w-5 h-5" />
                      Resend Email (Email OTP)
                    </CardTitle>
                    <CardDescription>
                      Enable Resend for email OTP verification during signup/login. Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com</a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-1">
                        <Label className="font-medium flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Enable Email OTP Verification
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          When enabled, users can verify via email OTP during signup/login
                        </p>
                      </div>
                      <Switch
                        checked={emailOtpEnabled}
                        onCheckedChange={toggleEmailOtp}
                        disabled={settingsLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="resend-key">Resend API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id="resend-key"
                          type={showResendKey ? 'text' : 'password'}
                          placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={resendApiKey}
                          onChange={(e) => setResendApiKey(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowResendKey(!showResendKey)}
                        >
                          {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Test Section */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
                      <Label className="text-sm font-medium">Test Resend Configuration</Label>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="Enter test email address"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={testResendCredentials}
                          disabled={testingResend || (!isResendConfigured && !resendBackendConfigured)}
                        >
                          {testingResend ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : resendTestResult === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                          ) : resendTestResult === 'error' ? (
                            <XCircle className="w-4 h-4 mr-2 text-destructive" />
                          ) : (
                            <PlayCircle className="w-4 h-4 mr-2" />
                          )}
                          Test
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-end">
                      <Button onClick={saveResendConfig} disabled={resendConfigSaving}>
                        <Save className="w-4 h-4 mr-2" />
                        {resendConfigSaving ? 'Saving...' : 'Save Resend Configuration'}
                      </Button>
                    </div>

                    {resendBackendConfigured && (
                      <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                        <div className="flex items-start gap-3">
                          <Key className="w-5 h-5 text-blue-500 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm text-blue-600">Backend Secret Configured</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              RESEND_API_KEY is set in backend secrets. You can test it below without entering the key here.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!resendBackendConfigured && isResendConfigured && (
                      <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                          <div>
                            <p className="font-medium text-sm text-success">Resend API Configured</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Email OTP messages will be sent via Resend.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>• Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com/api-keys</a></p>
                      <p>• Verify your sending domain at <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com/domains</a></p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`mt-6 ${phoneOtpEnabled ? 'border-success/50' : ''}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MessageSquare className="w-5 h-5" />
                      Twilio SMS (Phone OTP)
                    </CardTitle>
                    <CardDescription>
                      Enable Twilio SMS for phone number verification during signup. Get your credentials from <a href="https://www.twilio.com/console" target="_blank" rel="noopener noreferrer" className="text-primary underline">twilio.com/console</a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-1">
                        <Label className="font-medium flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Enable Phone OTP Verification
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          When enabled, users can verify via phone OTP during signup/login
                        </p>
                      </div>
                      <Switch
                        checked={phoneOtpEnabled}
                        onCheckedChange={togglePhoneOtp}
                        disabled={settingsLoading}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="twilio-sid">Account SID</Label>
                        <Input
                          id="twilio-sid"
                          type={showTwilioKeys ? 'text' : 'password'}
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={twilioAccountSid}
                          onChange={(e) => setTwilioAccountSid(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twilio-token">Auth Token</Label>
                        <Input
                          id="twilio-token"
                          type={showTwilioKeys ? 'text' : 'password'}
                          placeholder="Your auth token"
                          value={twilioAuthToken}
                          onChange={(e) => setTwilioAuthToken(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twilio-phone">Phone Number</Label>
                        <Input
                          id="twilio-phone"
                          type={showTwilioKeys ? 'text' : 'password'}
                          placeholder="+1234567890"
                          value={twilioPhoneNumber}
                          onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    {/* Test Section */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
                      <Label className="text-sm font-medium">Test Twilio Configuration</Label>
                      <div className="flex gap-2">
                        <Input
                          type="tel"
                          placeholder="Enter test phone number (+1234567890)"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={testTwilioCredentials}
                          disabled={testingTwilio || (!isTwilioConfigured && !twilioBackendConfigured)}
                        >
                          {testingTwilio ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : twilioTestResult === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                          ) : twilioTestResult === 'error' ? (
                            <XCircle className="w-4 h-4 mr-2 text-destructive" />
                          ) : (
                            <PlayCircle className="w-4 h-4 mr-2" />
                          )}
                          Test
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTwilioKeys(!showTwilioKeys)}
                      >
                        {showTwilioKeys ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                        {showTwilioKeys ? 'Hide Keys' : 'Show Keys'}
                      </Button>
                      <Button onClick={saveTwilioConfig} disabled={twilioConfigSaving}>
                        <Save className="w-4 h-4 mr-2" />
                        {twilioConfigSaving ? 'Saving...' : 'Save Twilio Configuration'}
                      </Button>
                    </div>

                    {twilioBackendConfigured && (
                      <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                        <div className="flex items-start gap-3">
                          <Key className="w-5 h-5 text-blue-500 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm text-blue-600">Backend Secrets Configured</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set in backend secrets. You can test it below without entering keys here.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!twilioBackendConfigured && isTwilioConfigured && (
                      <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                          <div>
                            <p className="font-medium text-sm text-success">Twilio Credentials Configured</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              OTP messages will be sent from your Twilio number.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>• <strong>Account SID:</strong> Found in Twilio Console → Account Info</p>
                      <p>• <strong>Auth Token:</strong> Found in Twilio Console → Account Info (keep secret!)</p>
                      <p>• <strong>Phone Number:</strong> Your Twilio phone number (format: +1234567890)</p>
                    </div>
                  </CardContent>
                </Card>

                {/* SMS Templates */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MessageSquare className="w-5 h-5" />
                      SMS Message Templates
                    </CardTitle>
                    <CardDescription>
                      Customize OTP messages. Use {'{{OTP}}'} as placeholder for the verification code.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="sms-signup">Signup OTP Template</Label>
                      <textarea
                        id="sms-signup"
                        value={smsTemplateSignup}
                        onChange={(e) => setSmsTemplateSignup(e.target.value)}
                        className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                        placeholder="Your verification code is: {{OTP}}"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sms-login">Login OTP Template</Label>
                      <textarea
                        id="sms-login"
                        value={smsTemplateLogin}
                        onChange={(e) => setSmsTemplateLogin(e.target.value)}
                        className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                        placeholder="Your login code is: {{OTP}}"
                      />
                    </div>
                    <Button onClick={saveSmsTemplates} disabled={smsTemplatesSaving}>
                      <Save className="w-4 h-4 mr-2" />
                      {smsTemplatesSaving ? 'Saving...' : 'Save Templates'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Landing Page Toggle */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Globe className="w-5 h-5" />
                      Landing Page Settings
                    </CardTitle>
                    <CardDescription>
                      Control the public landing page behavior
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="marketing-page" className="font-medium">
                          Show Marketing Landing Page
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          When disabled, visitors go directly to the login page. Enable this if you want to show a marketing page.
                        </p>
                      </div>
                      <Switch
                        id="marketing-page"
                        checked={marketingPageEnabled}
                        onCheckedChange={toggleMarketingPage}
                        disabled={settingsLoading}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Face Verification Toggle */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ScanFace className="w-5 h-5" />
                      Attendance Features
                    </CardTitle>
                    <CardDescription>
                      Enable or disable attendance-related features
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="face-verification" className="font-medium">
                          Face Verification
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Require employees to set up and verify face during attendance
                        </p>
                      </div>
                      <Switch
                        id="face-verification"
                        checked={faceVerificationEnabled}
                        onCheckedChange={toggleFaceVerification}
                        disabled={settingsLoading}
                      />
                    </div>

                    {/* Face Verification Threshold Slider */}
                    {faceVerificationEnabled && (
                      <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                        <div className="space-y-1">
                          <Label htmlFor="face-threshold" className="font-medium flex items-center gap-2">
                            <ScanFace className="w-4 h-4" />
                            Confidence Threshold: <span className="text-primary font-bold">{faceVerificationThreshold}%</span>
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Minimum confidence level required for face match (higher = stricter)
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">50%</span>
                          <input
                            type="range"
                            id="face-threshold"
                            min="50"
                            max="95"
                            step="5"
                            value={faceVerificationThreshold}
                            onChange={(e) => setFaceVerificationThreshold(Number(e.target.value))}
                            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                            disabled={settingsLoading}
                          />
                          <span className="text-xs text-muted-foreground">95%</span>
                          <Button 
                            size="sm" 
                            onClick={() => saveFaceThreshold(faceVerificationThreshold)}
                            disabled={settingsLoading}
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {[60, 70, 80, 90].map((val) => (
                            <Button
                              key={val}
                              variant={faceVerificationThreshold === val ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setFaceVerificationThreshold(val);
                                saveFaceThreshold(val);
                              }}
                              disabled={settingsLoading}
                            >
                              {val}%
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="gps-tracking" className="font-medium flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          GPS Location Tracking
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Capture employee location during check-in/check-out
                        </p>
                      </div>
                      <Switch
                        id="gps-tracking"
                        checked={gpsTrackingEnabled}
                        onCheckedChange={toggleGpsTracking}
                        disabled={settingsLoading}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="photo-capture" className="font-medium flex items-center gap-2">
                          <Camera className="w-4 h-4" />
                          Photo Capture
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Require photo capture during check-in/check-out
                        </p>
                      </div>
                      <Switch
                        id="photo-capture"
                        checked={photoCaptureEnabled}
                        onCheckedChange={togglePhotoCapture}
                        disabled={settingsLoading}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="overtime-tracking" className="font-medium flex items-center gap-2">
                          <Timer className="w-4 h-4" />
                          Overtime Tracking
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Track and calculate employee overtime hours
                        </p>
                      </div>
                      <Switch
                        id="overtime-tracking"
                        checked={overtimeTrackingEnabled}
                        onCheckedChange={toggleOvertimeTracking}
                        disabled={settingsLoading}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="leave-management" className="font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Leave Management
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Enable leave request and approval system
                        </p>
                      </div>
                      <Switch
                        id="leave-management"
                        checked={leaveManagementEnabled}
                        onCheckedChange={toggleLeaveManagement}
                        disabled={settingsLoading}
                      />
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <MobileBottomNav />
      <div className="h-16 sm:hidden" />
    </div>
  );
}
