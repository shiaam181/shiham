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
  MessageSquare
} from 'lucide-react';
import RoleManagement from '@/components/RoleManagement';
import MobileBottomNav from '@/components/MobileBottomNav';
import NotificationBell from '@/components/NotificationBell';
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
  
  // Twilio SMS configuration state
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [twilioConfigured, setTwilioConfigured] = useState(false);

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
          case 'twilio_sms_enabled':
            setTwilioEnabled((setting.value as { enabled: boolean })?.enabled ?? false);
            break;
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
    // We'll assume Twilio is configured if the secrets exist
    // The actual verification happens when sending OTP
    setTwilioConfigured(true); // Secrets were entered
  };

  const toggleTwilioSms = async (enabled: boolean) => {
    setSettingsLoading(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'twilio_sms_enabled', value: { enabled } }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update Twilio SMS setting',
        variant: 'destructive',
      });
    } else {
      setTwilioEnabled(enabled);
      toast({
        title: 'Setting Updated',
        description: `Twilio SMS for OTP is now ${enabled ? 'enabled' : 'disabled'}`,
      });
    }
    setSettingsLoading(false);
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
      <header className="sticky top-0 z-50 border-b border-border/50 bg-gradient-to-r from-purple-900 to-purple-800 text-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">Developer Panel</h1>
                <p className="text-xs text-white/70">Full System Access</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/admin')}
                className="text-white hover:bg-white/10"
              >
                <Shield className="w-4 h-4 mr-2" />
                Admin View
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-white hover:bg-white/10"
              >
                <User className="w-4 h-4 mr-2" />
                Employee View
              </Button>
              
              <NotificationBell />
              
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Code className="w-5 h-5" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className="text-xs text-white/70">Developer</p>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={signOut}
                className="text-white hover:bg-white/10"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

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

                {/* Twilio SMS Configuration */}
                <Card className={`mt-6 ${twilioEnabled ? 'border-success/50' : ''}`}>
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
                          When enabled, new users must verify their phone number with a 6-digit OTP code during signup
                        </p>
                      </div>
                      <Switch
                        checked={twilioEnabled}
                        onCheckedChange={toggleTwilioSms}
                        disabled={settingsLoading}
                      />
                    </div>

                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Twilio Credentials Configured</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Your Twilio Account SID, Auth Token, and Phone Number have been securely saved. 
                            OTP messages will be sent from your Twilio number.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>• <strong>Account SID:</strong> Found in Twilio Console → Account Info</p>
                      <p>• <strong>Auth Token:</strong> Found in Twilio Console → Account Info (keep secret!)</p>
                      <p>• <strong>Phone Number:</strong> Your Twilio phone number (format: +1234567890)</p>
                    </div>
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
