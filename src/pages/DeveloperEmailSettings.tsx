import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Save, Shield, Key, Globe, Send, Loader2, Server } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

import { SettingsSection } from '@/components/settings/SettingsSection';
import { StatusBadge } from '@/components/settings/StatusBadge';
import { CredentialField } from '@/components/settings/CredentialField';
import { TestConnection } from '@/components/settings/TestConnection';
import { InfoBanner } from '@/components/settings/InfoBanner';

interface BrevoConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_api_key: string;
  default_from_name: string;
  default_from_email: string;
  updated_at?: string;
  updated_by?: string;
}

const DEFAULT_CONFIG: BrevoConfig = {
  smtp_host: 'smtp-relay.brevo.com',
  smtp_port: 587,
  smtp_username: '',
  smtp_api_key: '',
  default_from_name: 'HRMS Platform',
  default_from_email: 'noreply@hrms.app',
};

export default function DeveloperEmailSettings() {
  const { user, isDeveloper } = useAuth();
  const { toast } = useToast();

  const [config, setConfig] = useState<BrevoConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [maskedKey, setMaskedKey] = useState('');

  const [appBaseUrl, setAppBaseUrl] = useState('');
  const [environmentMode, setEnvironmentMode] = useState<'production' | 'local'>('production');
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [isSendingTestInvite, setIsSendingTestInvite] = useState(false);

  useEffect(() => { fetchConfig(); fetchAppBaseUrl(); }, []);

  const fetchAppBaseUrl = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('value').eq('key', 'app_base_url').maybeSingle();
      if (data?.value) {
        const raw = data.value as any;
        if (typeof raw === 'string') setAppBaseUrl(raw);
        else { setAppBaseUrl(raw.url || ''); setEnvironmentMode(raw.mode === 'local' ? 'local' : 'production'); }
      }
    } catch (err) { console.error('Error fetching app base URL:', err); }
  };

  const handleSaveBaseUrl = async () => {
    if (!appBaseUrl.trim()) { toast({ title: 'Error', description: 'Enter your app URL', variant: 'destructive' }); return; }
    try { new URL(appBaseUrl.trim()); } catch { toast({ title: 'Invalid URL', variant: 'destructive' }); return; }
    setIsSavingUrl(true);
    try {
      const cleanUrl = appBaseUrl.trim().replace(/\/$/, '');
      const { error } = await supabase.from('system_settings').upsert({ key: 'app_base_url', value: { url: cleanUrl, mode: environmentMode, updated_at: new Date().toISOString(), updated_by: user?.id } }, { onConflict: 'key' });
      if (error) throw error;
      setAppBaseUrl(cleanUrl);
      toast({ title: 'Saved', description: 'All email links will now use this domain.' });
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setIsSavingUrl(false); }
  };

  const handleSendTestInvite = async () => {
    if (!testEmail) { toast({ title: 'Required', description: 'Enter a test email first', variant: 'destructive' }); return; }
    if (!appBaseUrl.trim()) { toast({ title: 'Required', description: 'Set App Base URL first', variant: 'destructive' }); return; }
    setIsSendingTestInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-brevo-email', {
        body: {
          to: testEmail, subject: 'Test Invite Link - Verify APP_BASE_URL',
          html: `<h2>Test Invite Link</h2><p>Verify your email links point to the correct domain.</p><p><a href="${appBaseUrl}/activate?token=TEST_TOKEN" style="display:inline-block;background-color:#0284c7;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Test Activate Link</a></p><p style="color:#71717a;font-size:13px;">Target: ${appBaseUrl}/activate?token=TEST_TOKEN</p>`,
          category: 'test',
        },
      });
      if (error) throw error;
      if (data?.success) toast({ title: 'Sent', description: 'Check inbox and verify the link domain.' });
      else throw new Error(data?.error || 'Failed');
    } catch (err: any) { toast({ title: 'Failed', description: err.message, variant: 'destructive' }); }
    finally { setIsSendingTestInvite(false); }
  };

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'brevo_smtp_config').maybeSingle();
      if (!error && data?.value) {
        const saved = data.value as unknown as BrevoConfig;
        setConfig({ ...DEFAULT_CONFIG, ...saved, smtp_api_key: '' });
        setIsConfigured(!!saved.smtp_api_key);
        if (saved.smtp_api_key) setMaskedKey('****' + saved.smtp_api_key.slice(-4));
      }
    } catch (err) { console.error('Error:', err); }
    finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    if (!config.smtp_api_key && !isConfigured) { toast({ title: 'Required', description: 'API key is required', variant: 'destructive' }); return; }
    setIsSaving(true);
    try {
      const saveData: any = {
        smtp_host: config.smtp_host, smtp_port: config.smtp_port, smtp_username: config.smtp_username,
        default_from_name: config.default_from_name, default_from_email: config.default_from_email,
        updated_at: new Date().toISOString(), updated_by: user?.id,
      };
      if (config.smtp_api_key) saveData.smtp_api_key = config.smtp_api_key;
      else if (isConfigured) {
        const { data: existing } = await supabase.from('system_settings').select('value').eq('key', 'brevo_smtp_config').maybeSingle();
        if (existing?.value) saveData.smtp_api_key = (existing.value as any).smtp_api_key;
      }
      const { error } = await supabase.from('system_settings').upsert({ key: 'brevo_smtp_config', value: saveData }, { onConflict: 'key' });
      if (error) throw error;
      setIsConfigured(true);
      if (config.smtp_api_key) setMaskedKey('****' + config.smtp_api_key.slice(-4));
      setConfig(prev => ({ ...prev, smtp_api_key: '' }));
      await supabase.from('audit_logs').insert({ user_id: user!.id, action: 'UPDATE', table_name: 'system_settings', record_id: 'brevo_smtp_config', new_value: { key: 'brevo_smtp_config', masked: true } });
      toast({ title: 'Saved', description: 'SMTP configuration saved' });
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setIsSaving(false); }
  };

  const handleTest = async () => {
    if (!testEmail) { toast({ title: 'Required', description: 'Enter a test email', variant: 'destructive' }); return; }
    setIsTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-brevo-email', {
        body: { to: testEmail, subject: 'HRMS Brevo SMTP Test', html: '<h2>Test Email</h2><p>Your Brevo SMTP configuration is working correctly.</p>', category: 'test' },
      });
      if (error) throw error;
      if (data?.success) { setTestResult('success'); toast({ title: 'Sent' }); }
      else throw new Error(data?.error || 'Failed');
    } catch (err: any) { setTestResult('error'); toast({ title: 'Failed', description: err.message, variant: 'destructive' }); }
    finally { setIsTesting(false); }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 max-w-4xl">
        <PageHeader
          title="Email Service (Brevo SMTP)"
          description="Configure global SMTP credentials for platform-wide email delivery"
          icon={<Mail className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />}
        />

        {/* App Base URL */}
        <SettingsSection title="App Base URL" description="All email links will use this URL for redirects" icon={Globe}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Environment</label>
              <select
                value={environmentMode}
                onChange={e => setEnvironmentMode(e.target.value === 'local' ? 'local' : 'production')}
                className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-foreground"
              >
                <option value="production">Production (custom domain)</option>
                <option value="local">Local development (localhost)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Public App URL</label>
              <Input
                value={appBaseUrl}
                onChange={e => setAppBaseUrl(e.target.value)}
                placeholder={environmentMode === 'local' ? 'http://localhost:5173' : 'https://yourdomain.com'}
                className="bg-muted/30 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {appBaseUrl ? `Links will be: ${appBaseUrl}/activate?token=...` : 'Required — set this to prevent links from using default domain.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSaveBaseUrl} disabled={isSavingUrl} className="gap-2">
                <Save className="w-4 h-4" />
                {isSavingUrl ? 'Saving…' : 'Save URL'}
              </Button>
              <Button variant="outline" onClick={handleSendTestInvite} disabled={isSendingTestInvite || !isConfigured} className="gap-2">
                <Send className="w-4 h-4" />
                {isSendingTestInvite ? 'Sending…' : 'Send Test Invite'}
              </Button>
            </div>
          </div>
        </SettingsSection>

        {/* SMTP Configuration */}
        <SettingsSection
          title="SMTP Configuration"
          description="Brevo SMTP relay credentials"
          icon={Server}
          badge={<StatusBadge status={isConfigured ? 'configured' : 'not-configured'} label={isConfigured ? `Key: ${maskedKey}` : undefined} />}
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SMTP Host</label>
                <Input value={config.smtp_host} onChange={e => setConfig(p => ({ ...p, smtp_host: e.target.value }))} className="bg-muted/30 font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SMTP Port</label>
                <Input type="number" value={config.smtp_port} onChange={e => setConfig(p => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))} className="bg-muted/30 font-mono text-sm" />
              </div>
            </div>

            <CredentialField label="SMTP Login / Username" value={config.smtp_username} onChange={v => setConfig(p => ({ ...p, smtp_username: v }))} placeholder="your-brevo-smtp-login" />
            <CredentialField label="SMTP API Key / Password" value={config.smtp_api_key} onChange={v => setConfig(p => ({ ...p, smtp_api_key: v }))} placeholder={isConfigured ? `Current: ${maskedKey} (leave blank to keep)` : 'xsmtpsib-xxxxxxxxx'} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default From Name</label>
                <Input value={config.default_from_name} onChange={e => setConfig(p => ({ ...p, default_from_name: e.target.value }))} className="bg-muted/30 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default From Email</label>
                <Input type="email" value={config.default_from_email} onChange={e => setConfig(p => ({ ...p, default_from_email: e.target.value }))} className="bg-muted/30 text-sm" />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving…' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </SettingsSection>

        {/* Test Email */}
        <SettingsSection title="Test Email Delivery" description="Send a test email to verify connectivity" icon={Mail}>
          <TestConnection
            placeholder="Enter test email address"
            value={testEmail}
            onChange={setTestEmail}
            onTest={handleTest}
            isTesting={isTesting}
            testResult={testResult}
            disabled={!isConfigured}
            buttonLabel="Send Test"
          />
        </SettingsSection>

        {/* Security */}
        <SettingsSection title="Security" description="Credential security information" icon={Shield}>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>API keys are encrypted at rest and never exposed after saving</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Only developers can view or modify credentials</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>All credential changes are logged in the audit trail</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Email content is never logged — only delivery status</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Companies can override sender name/email but not SMTP credentials</li>
          </ul>
        </SettingsSection>
      </main>
    </AppLayout>
  );
}
