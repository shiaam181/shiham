import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileText, Plus, Edit, Archive, Loader2, Eye, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import PayslipTemplatePreview from '@/components/PayslipTemplatePreview';

interface PlatformTemplate {
  id: string;
  name: string;
  description: string | null;
  template_type: string;
  template_content: string;
  preview_image_url: string | null;
  status: string;
  version: number;
  created_at: string;
}

const DEFAULT_TEMPLATE = `<div style="max-width:800px;margin:0 auto;border:2px solid {{PRIMARY_COLOR}};font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;">
  <div style="background:{{PRIMARY_COLOR}};color:white;padding:24px;text-align:center;">
    {{#LOGO}}<img src="{{LOGO}}" alt="Logo" style="max-height:50px;margin-bottom:8px;" />{{/LOGO}}
    <h1 style="font-size:22px;font-weight:700;margin:0;">{{COMPANY_NAME}}</h1>
    {{#HEADER_TEXT}}<p style="font-size:12px;opacity:0.85;margin:4px 0 0;">{{HEADER_TEXT}}</p>{{/HEADER_TEXT}}
    <p style="font-size:13px;opacity:0.9;margin:4px 0 0;">Salary Slip</p>
  </div>
  <div style="background:#f0f9ff;padding:12px 24px;text-align:center;font-weight:600;color:{{PRIMARY_COLOR}};border-bottom:1px solid #bae6fd;font-size:14px;">
    Payslip for {{MONTH_NAME}} {{YEAR}}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e2e8f0;">
    <div style="padding:10px 24px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;border-right:1px solid #e2e8f0;"><span style="color:#64748b;">Employee Name</span><span style="font-weight:600;">{{EMPLOYEE_NAME}}</span></div>
    <div style="padding:10px 24px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;"><span style="color:#64748b;">Department</span><span style="font-weight:600;">{{DEPARTMENT}}</span></div>
    <div style="padding:10px 24px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;border-right:1px solid #e2e8f0;"><span style="color:#64748b;">Working Days</span><span style="font-weight:600;">{{WORKING_DAYS}}</span></div>
    <div style="padding:10px 24px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;"><span style="color:#64748b;">Present Days</span><span style="font-weight:600;">{{PRESENT_DAYS}}</span></div>
    <div style="padding:10px 24px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;border-right:1px solid #e2e8f0;"><span style="color:#64748b;">Leave Days</span><span style="font-weight:600;">{{LEAVE_DAYS}}</span></div>
    <div style="padding:10px 24px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;"><span style="color:#64748b;">LOP Days</span><span style="font-weight:600;">{{LOP_DAYS}}</span></div>
  </div>
  <div style="background:#f0fdf4;padding:10px 24px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0;color:#15803d;border-left:4px solid #16a34a;">Earnings</div>
  <div style="display:flex;justify-content:space-between;padding:8px 24px;font-size:13px;border-bottom:1px solid #f1f5f9;"><span>Basic Salary</span><span>{{BASIC_SALARY}}</span></div>
  <div style="display:flex;justify-content:space-between;padding:8px 24px;font-size:13px;border-bottom:1px solid #f1f5f9;"><span>HRA</span><span>{{HRA}}</span></div>
  <div style="display:flex;justify-content:space-between;padding:8px 24px;font-size:13px;border-bottom:1px solid #f1f5f9;"><span>Special Allowance</span><span>{{SPECIAL_ALLOWANCE}}</span></div>
  <div style="display:flex;justify-content:space-between;padding:8px 24px;font-size:13px;border-bottom:1px solid #f1f5f9;"><span>Other Allowances</span><span>{{OTHER_ALLOWANCES}}</span></div>
  <div style="display:flex;justify-content:space-between;padding:12px 24px;font-size:14px;font-weight:700;border-top:2px solid #e2e8f0;background:#f8fafc;"><span>Total Earnings</span><span style="color:#15803d;">{{GROSS_SALARY}}</span></div>
  <div style="background:#fef2f2;padding:10px 24px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0;color:#dc2626;border-left:4px solid #dc2626;">Deductions</div>
  {{DEDUCTION_ROWS}}
  <div style="display:flex;justify-content:space-between;padding:12px 24px;font-size:14px;font-weight:700;border-top:2px solid #e2e8f0;background:#f8fafc;"><span>Total Deductions</span><span style="color:#dc2626;">{{TOTAL_DEDUCTIONS}}</span></div>
  <div style="background:{{PRIMARY_COLOR}};color:white;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:16px;font-weight:700;">Net Pay</span><span style="font-size:22px;font-weight:800;">{{NET_SALARY}}</span></div>
  <div style="padding:12px 24px;font-size:12px;color:#64748b;font-style:italic;border-top:1px solid #e2e8f0;"><strong>In Words:</strong> {{NET_IN_WORDS}}</div>
  {{#EMPLOYER_CONTRIBUTIONS}}<div style="padding:8px 24px;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;"><strong>Employer Contributions:</strong> PF: {{PF_EMPLOYER}} | ESI: {{ESI_EMPLOYER}}</div>{{/EMPLOYER_CONTRIBUTIONS}}
  <div style="padding:20px 24px;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
    <span>{{#FOOTER_TEXT}}{{FOOTER_TEXT}}{{/FOOTER_TEXT}}{{^FOOTER_TEXT}}Computer generated — no signature required{{/FOOTER_TEXT}}</span>
    <span>Generated on {{GENERATED_DATE}}</span>
  </div>
</div>`;

const MODERN_TEMPLATE = `<div style="max-width:800px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,{{PRIMARY_COLOR}} 0%,{{SECONDARY_COLOR}} 100%);color:white;padding:32px 24px;position:relative;">
    {{#LOGO}}<img src="{{LOGO}}" alt="Logo" style="max-height:40px;margin-bottom:12px;" />{{/LOGO}}
    <h1 style="font-size:24px;font-weight:800;margin:0;letter-spacing:-0.5px;">{{COMPANY_NAME}}</h1>
    {{#HEADER_TEXT}}<p style="font-size:12px;opacity:0.8;margin:4px 0 0;">{{HEADER_TEXT}}</p>{{/HEADER_TEXT}}
    <div style="position:absolute;top:24px;right:24px;background:rgba(255,255,255,0.15);border-radius:8px;padding:8px 16px;text-align:center;">
      <div style="font-size:20px;font-weight:800;">{{MONTH_SHORT}}</div>
      <div style="font-size:12px;opacity:0.9;">{{YEAR}}</div>
    </div>
  </div>
  <div style="padding:24px;background:#f8fafc;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="background:white;border-radius:8px;padding:12px 16px;"><span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Employee</span><div style="font-weight:600;font-size:14px;margin-top:2px;">{{EMPLOYEE_NAME}}</div></div>
      <div style="background:white;border-radius:8px;padding:12px 16px;"><span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Department</span><div style="font-weight:600;font-size:14px;margin-top:2px;">{{DEPARTMENT}}</div></div>
      <div style="background:white;border-radius:8px;padding:12px 16px;"><span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Working / Present</span><div style="font-weight:600;font-size:14px;margin-top:2px;">{{PRESENT_DAYS}} / {{WORKING_DAYS}}</div></div>
      <div style="background:white;border-radius:8px;padding:12px 16px;"><span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Leave / LOP</span><div style="font-weight:600;font-size:14px;margin-top:2px;">{{LEAVE_DAYS}} / {{LOP_DAYS}}</div></div>
    </div>
    <div style="background:white;border-radius:8px;overflow:hidden;margin-bottom:12px;">
      <div style="padding:12px 16px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#16a34a;background:#f0fdf4;border-bottom:2px solid #dcfce7;">💰 Earnings</div>
      <div style="padding:10px 16px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;"><span>Basic Salary</span><span style="font-weight:500;">{{BASIC_SALARY}}</span></div>
      <div style="padding:10px 16px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;"><span>HRA</span><span style="font-weight:500;">{{HRA}}</span></div>
      <div style="padding:10px 16px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;"><span>Special Allowance</span><span style="font-weight:500;">{{SPECIAL_ALLOWANCE}}</span></div>
      <div style="padding:10px 16px;display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;"><span>Other Allowances</span><span style="font-weight:500;">{{OTHER_ALLOWANCES}}</span></div>
      <div style="padding:12px 16px;display:flex;justify-content:space-between;font-size:14px;font-weight:700;background:#f0fdf4;"><span>Total Earnings</span><span style="color:#16a34a;">{{GROSS_SALARY}}</span></div>
    </div>
    <div style="background:white;border-radius:8px;overflow:hidden;margin-bottom:12px;">
      <div style="padding:12px 16px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#dc2626;background:#fef2f2;border-bottom:2px solid #fecaca;">📉 Deductions</div>
      {{DEDUCTION_ROWS}}
      <div style="padding:12px 16px;display:flex;justify-content:space-between;font-size:14px;font-weight:700;background:#fef2f2;"><span>Total Deductions</span><span style="color:#dc2626;">{{TOTAL_DEDUCTIONS}}</span></div>
    </div>
    <div style="background:linear-gradient(135deg,{{PRIMARY_COLOR}} 0%,{{SECONDARY_COLOR}} 100%);color:white;border-radius:8px;padding:20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="font-size:18px;font-weight:700;">Net Pay</span><span style="font-size:28px;font-weight:800;">{{NET_SALARY}}</span></div>
    <div style="font-size:11px;color:#94a3b8;font-style:italic;padding:4px 0;"><strong>In Words:</strong> {{NET_IN_WORDS}}</div>
    {{#EMPLOYER_CONTRIBUTIONS}}<div style="font-size:11px;color:#94a3b8;padding:4px 0;"><strong>Employer:</strong> PF: {{PF_EMPLOYER}} | ESI: {{ESI_EMPLOYER}}</div>{{/EMPLOYER_CONTRIBUTIONS}}
  </div>
  <div style="padding:16px 24px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;background:#f1f5f9;">
    <span>{{#FOOTER_TEXT}}{{FOOTER_TEXT}}{{/FOOTER_TEXT}}{{^FOOTER_TEXT}}Computer generated — no signature required{{/FOOTER_TEXT}}</span>
    <span>{{GENERATED_DATE}}</span>
  </div>
</div>`;

export default function DeveloperPayslipTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<PlatformTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<PlatformTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateType, setTemplateType] = useState('html');

  // Preview
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_payslip_templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates((data as PlatformTemplate[]) || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setTemplateContent(DEFAULT_TEMPLATE);
    setTemplateType('html');
    setShowDialog(true);
  };

  const openEdit = (t: PlatformTemplate) => {
    setEditing(t);
    setName(t.name);
    setDescription(t.description || '');
    setTemplateContent(t.template_content);
    setTemplateType(t.template_type);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !templateContent.trim()) {
      toast({ title: 'Error', description: 'Name and content are required', variant: 'destructive' });
      return;
    }
    // Sanitize: strip script tags
    const sanitized = templateContent.replace(/<script[\s\S]*?<\/script>/gi, '');

    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('platform_payslip_templates')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          template_content: sanitized,
          template_type: templateType,
          version: editing.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Updated', description: 'Template updated successfully' });
    } else {
      const { error } = await supabase
        .from('platform_payslip_templates')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          template_content: sanitized,
          template_type: templateType,
          created_by: user?.id,
        });
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Created', description: 'New template created' });
    }
    setSaving(false);
    setShowDialog(false);
    fetchTemplates();
  };

  const toggleStatus = async (t: PlatformTemplate) => {
    const newStatus = t.status === 'active' ? 'archived' : 'active';
    await supabase
      .from('platform_payslip_templates')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', t.id);
    toast({ title: newStatus === 'active' ? 'Restored' : 'Archived' });
    fetchTemplates();
  };

  const seedDefaults = async () => {
    setSaving(true);
    const existing = templates.map(t => t.name);
    const toInsert = [];
    if (!existing.includes('Classic Professional')) {
      toInsert.push({ name: 'Classic Professional', description: 'Clean, traditional payslip layout with structured sections', template_type: 'html', template_content: DEFAULT_TEMPLATE, created_by: user?.id });
    }
    if (!existing.includes('Modern Card')) {
      toInsert.push({ name: 'Modern Card', description: 'Modern card-based layout with gradient header and rounded corners', template_type: 'html', template_content: MODERN_TEMPLATE, created_by: user?.id });
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('platform_payslip_templates').insert(toInsert);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Seeded', description: `${toInsert.length} default template(s) added` });
      fetchTemplates();
    } else {
      toast({ title: 'Already exists', description: 'Default templates already present' });
    }
    setSaving(false);
  };

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> Payslip Templates</h1>
            <p className="text-sm text-muted-foreground">Manage platform-wide default payslip templates for all tenants</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={seedDefaults} disabled={saving}>
              <RotateCcw className="w-4 h-4 mr-1" /> Seed Defaults
            </Button>
            <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> New Template</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : templates.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No templates yet. Click "Seed Defaults" to add starter templates.</p>
          </Card>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{t.template_type.toUpperCase()}</Badge></TableCell>
                    <TableCell>v{t.version}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => { setPreviewTemplate(t.template_content); setShowPreview(true); }}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(t)}>
                          <Archive className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Template' : 'Create Template'}</DialogTitle>
              <DialogDescription>
                Use placeholders like {'{{COMPANY_NAME}}'}, {'{{EMPLOYEE_NAME}}'}, {'{{BASIC_SALARY}}'}, etc. 
                Script tags will be stripped for security.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Classic Professional" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={templateType} onValueChange={setTemplateType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="html">HTML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" />
              </div>
              <div className="space-y-2">
                <Label>Template HTML *</Label>
                <Textarea
                  value={templateContent}
                  onChange={e => setTemplateContent(e.target.value)}
                  rows={15}
                  className="font-mono text-xs"
                  placeholder="Paste HTML template with placeholders..."
                />
              </div>
              <div className="bg-muted/50 p-3 rounded text-xs text-muted-foreground">
                <strong>Available placeholders:</strong> {'{{COMPANY_NAME}}'}, {'{{LOGO}}'}, {'{{HEADER_TEXT}}'}, {'{{FOOTER_TEXT}}'}, 
                {'{{PRIMARY_COLOR}}'}, {'{{SECONDARY_COLOR}}'}, {'{{EMPLOYEE_NAME}}'}, {'{{DEPARTMENT}}'}, {'{{MONTH_NAME}}'}, 
                {'{{MONTH_SHORT}}'}, {'{{YEAR}}'}, {'{{WORKING_DAYS}}'}, {'{{PRESENT_DAYS}}'}, {'{{LEAVE_DAYS}}'}, {'{{LOP_DAYS}}'}, 
                {'{{BASIC_SALARY}}'}, {'{{HRA}}'}, {'{{SPECIAL_ALLOWANCE}}'}, {'{{OTHER_ALLOWANCES}}'}, {'{{GROSS_SALARY}}'}, 
                {'{{DEDUCTION_ROWS}}'}, {'{{TOTAL_DEDUCTIONS}}'}, {'{{NET_SALARY}}'}, {'{{NET_IN_WORDS}}'}, 
                {'{{PF_EMPLOYER}}'}, {'{{ESI_EMPLOYER}}'}, {'{{GENERATED_DATE}}'}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <PayslipTemplatePreview
          open={showPreview}
          onOpenChange={setShowPreview}
          templateHtml={previewTemplate || ''}
        />
      </main>
    </AppLayout>
  );
}
