import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Globe
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
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['face_verification_required', 'show_marketing_landing_page']);
    
    if (!error && data) {
      data.forEach((setting) => {
        if (setting.key === 'face_verification_required') {
          setFaceVerificationEnabled((setting.value as { enabled: boolean }).enabled);
        }
        if (setting.key === 'show_marketing_landing_page') {
          setMarketingPageEnabled((setting.value as { enabled: boolean }).enabled);
        }
      });
    }
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
    setSettingsLoading(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ 
        key: 'show_marketing_landing_page', 
        value: { enabled } 
      }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update setting',
        variant: 'destructive',
      });
    } else {
      setMarketingPageEnabled(enabled);
      toast({
        title: 'Setting Updated',
        description: enabled ? 'Marketing landing page is now visible' : 'Users will go directly to login',
      });
    }
    setSettingsLoading(false);
  };

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
                onClick={() => navigate('/admin/settings')}
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
                onClick={() => navigate('/admin/shifts')}
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
                onClick={() => navigate('/admin/employees')}
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
                onClick={() => navigate('/admin/holidays')}
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
                onClick={() => navigate('/admin/reports')}
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
                onClick={() => navigate('/admin/leaves')}
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
                onClick={() => navigate('/admin/weekoffs')}
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
                    onClick={() => navigate('/admin/settings')}
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
                    onClick={() => navigate('/admin/shifts')}
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
                    onClick={() => navigate('/admin/weekoffs')}
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

                  <Card className="p-4 opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium">Email Configuration</p>
                        <p className="text-xs text-muted-foreground">Configure EmailJS in src/lib/emailjs.ts</p>
                      </div>
                    </div>
                  </Card>
                </div>

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
                      Face Verification Settings
                    </CardTitle>
                    <CardDescription>
                      Control whether face verification is required for employees
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="face-verification" className="font-medium">
                          Require Face Verification
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          When enabled, employees must set up face verification before accessing the dashboard
                        </p>
                      </div>
                      <Switch
                        id="face-verification"
                        checked={faceVerificationEnabled}
                        onCheckedChange={toggleFaceVerification}
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
