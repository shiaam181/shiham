import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileText, Save, Loader2, Eye, Palette, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import PayslipTemplatePreview from '@/components/PayslipTemplatePreview';

interface PlatformTemplate {
  id: string;
  name: string;
  description: string | null;
  template_content: string;
}

interface TenantSettings {
  id?: string;
  template_mode: string;
  selected_platform_template_id: string | null;
  custom_template_content: string | null;
  tenant_logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  header_text: string | null;
  footer_text: string | null;
}

export default function PayslipSettings() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const companyId = profile?.company_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [platformTemplates, setPlatformTemplates] = useState<PlatformTemplate[]>([]);
  const [settings, setSettings] = useState<TenantSettings>({
    template_mode: 'default',
    selected_platform_template_id: null,
    custom_template_content: null,
    tenant_logo_url: null,
    primary_color: null,
    secondary_color: null,
    header_text: null,
    footer_text: null,
  });

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (companyId) fetchAll();
  }, [companyId]);

  const fetchAll = async () => {
    setLoading(true);
    const [templatesRes, settingsRes, companyRes] = await Promise.all([
      supabase.from('platform_payslip_templates').select('id, name, description, template_content').eq('status', 'active'),
      supabase.from('tenant_payslip_settings').select('*').eq('company_id', companyId!).maybeSingle(),
      supabase.from('companies').select('brand_color, brand_color_secondary, logo_url').eq('id', companyId!).maybeSingle(),
    ]);

    setPlatformTemplates((templatesRes.data as PlatformTemplate[]) || []);

    if (settingsRes.data) {
      const d = settingsRes.data as any;
      setSettings({
        id: d.id,
        template_mode: d.template_mode || 'default',
        selected_platform_template_id: d.selected_platform_template_id,
        custom_template_content: d.custom_template_content,
        tenant_logo_url: d.tenant_logo_url,
        primary_color: d.primary_color || companyRes.data?.brand_color || null,
        secondary_color: d.secondary_color || companyRes.data?.brand_color_secondary || null,
        header_text: d.header_text,
        footer_text: d.footer_text,
      });
    } else if (companyRes.data) {
      setSettings(prev => ({
        ...prev,
        primary_color: companyRes.data?.brand_color || null,
        secondary_color: companyRes.data?.brand_color_secondary || null,
        tenant_logo_url: companyRes.data?.logo_url || null,
      }));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!companyId) return;

    if (settings.template_mode === 'default' && !settings.selected_platform_template_id) {
      toast({ title: 'Warning', description: 'Please select a platform template', variant: 'destructive' });
      return;
    }
    if (settings.template_mode === 'custom' && !settings.custom_template_content?.trim()) {
      toast({ title: 'Warning', description: 'Custom template content is empty', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const payload: any = {
      company_id: companyId,
      template_mode: settings.template_mode,
      selected_platform_template_id: settings.template_mode === 'default' ? settings.selected_platform_template_id : null,
      custom_template_content: settings.template_mode === 'custom' ? (settings.custom_template_content?.replace(/<script[\s\S]*?<\/script>/gi, '') || null) : null,
      tenant_logo_url: settings.tenant_logo_url || null,
      primary_color: settings.primary_color || null,
      secondary_color: settings.secondary_color || null,
      header_text: settings.header_text || null,
      footer_text: settings.footer_text || null,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('tenant_payslip_settings')
      .upsert(payload, { onConflict: 'company_id' });

    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Saved', description: 'Payslip settings updated' });

    setSaving(false);
    fetchAll();
  };

  const openPreview = () => {
    let html = '';
    if (settings.template_mode === 'default') {
      const tpl = platformTemplates.find(t => t.id === settings.selected_platform_template_id);
      if (!tpl) { toast({ title: 'Select a template first', variant: 'destructive' }); return; }
      html = tpl.template_content;
    } else {
      html = settings.custom_template_content || '';
    }
    if (!html) { toast({ title: 'No template to preview', variant: 'destructive' }); return; }
    setPreviewHtml(html);
    setShowPreview(true);
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> Payslip Settings</h1>
          <p className="text-sm text-muted-foreground">Configure how payslips look for your company</p>
        </div>

        {/* Mode Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Template Mode</CardTitle>
            <CardDescription>Choose between platform default templates or fully custom layout</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${settings.template_mode === 'default' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                onClick={() => setSettings(s => ({ ...s, template_mode: 'default' }))}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Default Template</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use a platform-provided template. You can only customize logo, colors, and header/footer text.
                </p>
              </div>
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${settings.template_mode === 'custom' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                onClick={() => setSettings(s => ({ ...s, template_mode: 'custom' }))}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Custom Template</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Full control over the payslip layout using HTML. Map all fields and customize everything.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Mode: Template Selection */}
        {settings.template_mode === 'default' && (
          <Card>
            <CardHeader>
              <CardTitle>Choose Platform Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {platformTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No platform templates available. Contact your administrator.</p>
              ) : (
                <Select
                  value={settings.selected_platform_template_id || ''}
                  onValueChange={v => setSettings(s => ({ ...s, selected_platform_template_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {platformTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.description ? `— ${t.description}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {/* Custom Mode: Template Editor */}
        {settings.template_mode === 'custom' && (
          <Card>
            <CardHeader>
              <CardTitle>Custom Template HTML</CardTitle>
              <CardDescription>Full control — use placeholders like {'{{EMPLOYEE_NAME}}'}, {'{{BASIC_SALARY}}'}, etc.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.custom_template_content || ''}
                onChange={e => setSettings(s => ({ ...s, custom_template_content: e.target.value }))}
                rows={15}
                className="font-mono text-xs"
                placeholder="Paste your custom HTML template..."
              />
            </CardContent>
          </Card>
        )}

        {/* Branding Controls (both modes) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" /> Branding</CardTitle>
            <CardDescription>Customize logo, colors, and text for your payslips</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Image className="w-4 h-4" /> Logo URL</Label>
              <Input
                value={settings.tenant_logo_url || ''}
                onChange={e => setSettings(s => ({ ...s, tenant_logo_url: e.target.value }))}
                placeholder="https://your-logo-url.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">Use your company logo URL. It will appear at the top of payslips.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.primary_color || '#0369a1'}
                    onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.primary_color || '#0369a1'}
                    onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                    placeholder="#0369a1"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.secondary_color || '#64748b'}
                    onChange={e => setSettings(s => ({ ...s, secondary_color: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.secondary_color || '#64748b'}
                    onChange={e => setSettings(s => ({ ...s, secondary_color: e.target.value }))}
                    placeholder="#64748b"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Header Text (optional)</Label>
                <Input
                  value={settings.header_text || ''}
                  onChange={e => setSettings(s => ({ ...s, header_text: e.target.value }))}
                  placeholder="e.g. CIN: U12345MH2020PTC123456"
                />
              </div>
              <div className="space-y-2">
                <Label>Footer Text (optional)</Label>
                <Input
                  value={settings.footer_text || ''}
                  onChange={e => setSettings(s => ({ ...s, footer_text: e.target.value }))}
                  placeholder="e.g. This is a computer-generated document"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={openPreview}>
            <Eye className="w-4 h-4 mr-1" /> Preview
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            <Save className="w-4 h-4 mr-1" /> Save Settings
          </Button>
        </div>

        <PayslipTemplatePreview
          open={showPreview}
          onOpenChange={setShowPreview}
          templateHtml={previewHtml}
          overrides={{
            COMPANY_NAME: profile?.full_name ? 'Your Company' : 'Company',
            PRIMARY_COLOR: settings.primary_color || '#0369a1',
            SECONDARY_COLOR: settings.secondary_color || '#64748b',
            LOGO: settings.tenant_logo_url || '',
            HEADER_TEXT: settings.header_text || '',
            FOOTER_TEXT: settings.footer_text || '',
          }}
        />
      </main>
    </AppLayout>
  );
}
