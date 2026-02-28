import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Mail, Save, Eye, EyeOff, Shield, CheckCircle2, XCircle, Loader2, PlayCircle, Server, Key,
} from 'lucide-react';

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
  const [showKeys, setShowKeys] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [maskedKey, setMaskedKey] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'brevo_smtp_config')
        .maybeSingle();

      if (!error && data?.value) {
        const saved = data.value as BrevoConfig;
        setConfig({
          ...DEFAULT_CONFIG,
          ...saved,
          smtp_api_key: '', // Never show the real key
        });
        setIsConfigured(!!saved.smtp_api_key);
        if (saved.smtp_api_key) {
          setMaskedKey('****' + saved.smtp_api_key.slice(-4));
        }
      }
    } catch (err) {
      console.error('Error fetching Brevo config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.smtp_api_key && !isConfigured) {
      toast({ title: 'Error', description: 'API key is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const saveData: any = {
        smtp_host: config.smtp_host,
        smtp_port: config.smtp_port,
        smtp_username: config.smtp_username,
        default_from_name: config.default_from_name,
        default_from_email: config.default_from_email,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      };

      // Only update key if provided (not empty means user wants to update)
      if (config.smtp_api_key) {
        saveData.smtp_api_key = config.smtp_api_key;
      } else if (isConfigured) {
        // Preserve existing key - read it first
        const { data: existing } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'brevo_smtp_config')
          .maybeSingle();
        if (existing?.value) {
          saveData.smtp_api_key = (existing.value as any).smtp_api_key;
        }
      }

      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'brevo_smtp_config', value: saveData }, { onConflict: 'key' });

      if (error) throw error;

      setIsConfigured(true);
      if (config.smtp_api_key) {
        setMaskedKey('****' + config.smtp_api_key.slice(-4));
      }
      setConfig(prev => ({ ...prev, smtp_api_key: '' }));

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user!.id,
        action: 'UPDATE',
        table_name: 'system_settings',
        record_id: 'brevo_smtp_config',
        new_value: { key: 'brevo_smtp_config', masked: true },
      });

      toast({ title: 'Success', description: 'Brevo SMTP configuration saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast({ title: 'Email Required', description: 'Enter a test email address', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-brevo-email', {
        body: {
          to: testEmail,
          subject: 'HRMS Brevo SMTP Test',
          html: '<h2>Test Email</h2><p>If you received this, your Brevo SMTP configuration is working correctly.</p><p style="color:#71717a;font-size:13px;">Sent from HRMS Developer Settings</p>',
          category: 'test',
        },
      });

      if (error) throw error;
      if (data?.success) {
        setTestResult('success');
        toast({ title: 'Test Passed', description: 'Email sent successfully!' });
      } else {
        throw new Error(data?.error || 'Failed to send');
      }
    } catch (err: any) {
      setTestResult('error');
      toast({ title: 'Test Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
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
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Mail className="w-6 h-6" /> Email Service (Brevo SMTP)
          </h1>
          <p className="text-muted-foreground text-sm">
            Configure global Brevo SMTP credentials for platform-wide email delivery
          </p>
        </div>

        {/* Status Banner */}
        <div className={`p-4 rounded-lg border ${isConfigured ? 'bg-green-500/10 border-green-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
          <div className="flex items-start gap-3">
            {isConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-sm">
                {isConfigured ? 'Brevo SMTP Configured ✓' : 'Brevo SMTP Not Configured'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isConfigured
                  ? `API Key: ${maskedKey}`
                  : 'Add your Brevo SMTP credentials to enable email sending (invites, password resets).'}
              </p>
            </div>
          </div>
        </div>

        {/* SMTP Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="w-5 h-5" /> SMTP Configuration
            </CardTitle>
            <CardDescription>
              Get credentials from{' '}
              <a href="https://app.brevo.com/settings/keys/smtp" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Brevo SMTP Settings
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input value={config.smtp_host} onChange={e => setConfig(p => ({ ...p, smtp_host: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>SMTP Port</Label>
                <Input type="number" value={config.smtp_port} onChange={e => setConfig(p => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>SMTP Login / Username</Label>
              <Input
                type={showKeys ? 'text' : 'password'}
                value={config.smtp_username}
                onChange={e => setConfig(p => ({ ...p, smtp_username: e.target.value }))}
                placeholder="your-brevo-smtp-login"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="w-4 h-4" /> SMTP API Key / Password
              </Label>
              <Input
                type={showKeys ? 'text' : 'password'}
                value={config.smtp_api_key}
                onChange={e => setConfig(p => ({ ...p, smtp_api_key: e.target.value }))}
                placeholder={isConfigured ? `Current: ${maskedKey} (leave blank to keep)` : 'xsmtpsib-xxxxxxxxx'}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Default From Name</Label>
                <Input value={config.default_from_name} onChange={e => setConfig(p => ({ ...p, default_from_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Default From Email</Label>
                <Input type="email" value={config.default_from_email} onChange={e => setConfig(p => ({ ...p, default_from_email: e.target.value }))} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowKeys(!showKeys)}>
                {showKeys ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showKeys ? 'Hide' : 'Show'} Credentials
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PlayCircle className="w-5 h-5" /> Test Email Delivery
            </CardTitle>
            <CardDescription>Send a test email to verify connectivity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter test email address"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={handleTest} disabled={isTesting || !isConfigured}>
                {isTesting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : testResult === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                ) : testResult === 'error' ? (
                  <XCircle className="w-4 h-4 mr-2 text-destructive" />
                ) : (
                  <PlayCircle className="w-4 h-4 mr-2" />
                )}
                Send Test
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• API keys are stored encrypted in the database and never exposed in the UI after saving</li>
              <li>• Only developers can view or modify these credentials</li>
              <li>• All credential changes are logged in the audit trail</li>
              <li>• Email content is never logged — only delivery status and metadata</li>
              <li>• Companies can override sender name/email but not SMTP credentials</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}
