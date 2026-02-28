import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building2, Save, Mail, Phone, MapPin, Clock, PlayCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import DataExportImport from '@/components/DataExportImport';
import { useAuth } from '@/contexts/AuthContext';

interface CompanySettings {
  id: string;
  company_name: string;
  company_logo_url: string | null;
  tagline: string | null;
  default_shift_id: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  timezone: string | null;
}

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

export default function CompanySettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  // Check if user came from developer panel
  const fromDeveloper = location.state?.from === 'developer';
  
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Email settings state
  const [emailFromName, setEmailFromName] = useState('');
  const [emailFromEmail, setEmailFromEmail] = useState('');
  const [emailReplyTo, setEmailReplyTo] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSettingsSaving, setEmailSettingsSaving] = useState(false);
  const [testEmailAddr, setTestEmailAddr] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<'success' | 'error' | null>(null);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [defaultShiftId, setDefaultShiftId] = useState('');
  const [timezone, setTimezone] = useState('');

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
        setCompanyName(data.company_name);
        setTagline(data.tagline || '');
        setAddress(data.address || '');
        setContactEmail(data.contact_email || '');
        setContactPhone(data.contact_phone || '');
        setDefaultShiftId(data.default_shift_id || '');
        setTimezone(data.timezone || 'UTC');
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load company settings',
        variant: 'destructive',
      });
    }
  };

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, name, start_time, end_time')
        .order('name');

      if (error) throw error;
      setShifts(data || []);
    } catch (error: any) {
      console.error('Error fetching shifts:', error);
    }
  };

  const fetchEmailSettings = async () => {
    if (!profile?.company_id) return;
    const { data } = await supabase
      .from('tenant_email_settings')
      .select('*')
      .eq('company_id', profile.company_id)
      .maybeSingle();
    if (data) {
      setEmailFromName(data.from_name || '');
      setEmailFromEmail(data.from_email || '');
      setEmailReplyTo(data.reply_to_email || '');
      setEmailEnabled(data.email_enabled ?? true);
    }
  };

  useEffect(() => {
    Promise.all([fetchSettings(), fetchShifts(), fetchEmailSettings()]).finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast({
        title: 'Error',
        description: 'Company name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        company_name: companyName.trim(),
        tagline: tagline.trim() || null,
        address: address.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        default_shift_id: defaultShiftId || null,
        timezone: timezone || 'UTC',
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(updateData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert(updateData);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Company settings saved successfully',
      });

      fetchSettings();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const timezones = [
    'UTC',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Australia/Sydney',
  ];

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company Information
            </CardTitle>
            <CardDescription>
              Basic information about your company
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Enter company tagline"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">
                <MapPin className="w-4 h-4 inline mr-1" />
                Address
              </Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter company address"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Contact Information
            </CardTitle>
            <CardDescription>
              Contact details for the company
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="company@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone
                </Label>
                <Input
                  id="contactPhone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Default Settings
            </CardTitle>
            <CardDescription>
              Configure default values for the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultShift">Default Shift</Label>
                <Select value={defaultShiftId} onValueChange={setDefaultShiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select default shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.name} ({shift.start_time} - {shift.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" /> Email Settings
            </CardTitle>
            <CardDescription>Configure how emails are sent from your company</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label className="font-medium">Enable Email Sending</Label>
                <p className="text-sm text-muted-foreground">Toggle email notifications for your company</p>
              </div>
              <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>From Name</Label>
                <Input value={emailFromName} onChange={e => setEmailFromName(e.target.value)} placeholder="Your Company Name" />
              </div>
              <div className="space-y-2">
                <Label>From Email</Label>
                <Input type="email" value={emailFromEmail} onChange={e => setEmailFromEmail(e.target.value)} placeholder="noreply@yourcompany.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reply-To Email</Label>
              <Input type="email" value={emailReplyTo} onChange={e => setEmailReplyTo(e.target.value)} placeholder="hr@yourcompany.com (optional)" />
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
              <Label className="text-sm font-medium">Send Test Email</Label>
              <div className="flex gap-2">
                <Input type="email" placeholder="test@email.com" value={testEmailAddr} onChange={e => setTestEmailAddr(e.target.value)} className="flex-1" />
                <Button variant="outline" disabled={testingEmail || !testEmailAddr} onClick={async () => {
                  setTestingEmail(true); setEmailTestResult(null);
                  try {
                    const { data, error } = await supabase.functions.invoke('send-brevo-email', {
                      body: { tenant_id: profile?.company_id, to: testEmailAddr, subject: 'Test Email from ' + (companyName || 'HRMS'), html: '<h2>Test Email</h2><p>Email configuration is working for your company.</p>' }
                    });
                    if (error || !data?.success) throw new Error(data?.error || 'Failed');
                    setEmailTestResult('success');
                  } catch { setEmailTestResult('error'); }
                  finally { setTestingEmail(false); }
                }}>
                  {testingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : emailTestResult === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : emailTestResult === 'error' ? <XCircle className="w-4 h-4 text-destructive" /> : <PlayCircle className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <Button disabled={emailSettingsSaving} onClick={async () => {
              if (!profile?.company_id) return;
              setEmailSettingsSaving(true);
              const { error } = await supabase.from('tenant_email_settings').upsert({
                company_id: profile.company_id, from_name: emailFromName || null, from_email: emailFromEmail || null,
                reply_to_email: emailReplyTo || null, email_enabled: emailEnabled, updated_at: new Date().toISOString(),
              }, { onConflict: 'company_id' });
              toast(error ? { title: 'Error', description: 'Failed to save', variant: 'destructive' as const } : { title: 'Saved', description: 'Email settings updated' });
              setEmailSettingsSaving(false);
            }}>
              <Save className="w-4 h-4 mr-2" />{emailSettingsSaving ? 'Saving...' : 'Save Email Settings'}
            </Button>
          </CardContent>
        </Card>

        {/* Data Backup & Restore */}
        {profile?.company_id && (
          <DataExportImport companyId={profile.company_id} companyName={companyName || 'company'} />
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </main>
    </AppLayout>
  );
}
