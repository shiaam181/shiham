import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { renderPayslipTemplate } from '@/components/PayslipTemplatePreview';

interface SalarySlipData {
  employeeName: string;
  department: string | null;
  email: string;
  employeeCode?: string | null;
  month: number;
  year: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  lopDays?: number;
  overtimeHours: number;
  basicSalary: number;
  hra: number;
  da: number;
  specialAllowance: number;
  otherAllowances: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  otherDeductions: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  companyName?: string;
  companyLogoUrl?: string | null;
  brandColor?: string | null;
  companyId?: string | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  return convert(Math.round(num)) + ' Rupees Only';
}

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function buildDeductionRows(data: SalarySlipData): string {
  const rows = [
    ['Provident Fund (PF)', data.pfEmployee],
    ['ESI', data.esiEmployee],
    ['Professional Tax', data.professionalTax],
    ['Income Tax (TDS)', data.tds],
    ['Other Deductions', data.otherDeductions],
  ].filter(([, val]) => Number(val) > 0);

  return rows.map(([label, val]) =>
    `<div style="display:flex;justify-content:space-between;padding:8px 24px;font-size:13px;border-bottom:1px solid #f1f5f9;padding:10px 16px;"><span>${label}</span><span>${formatCurrency(Number(val))}</span></div>`
  ).join('');
}

function buildPlaceholders(data: SalarySlipData, tenantSettings: any): Record<string, string> {
  return {
    COMPANY_NAME: data.companyName || 'Company',
    LOGO: tenantSettings?.tenant_logo_url || data.companyLogoUrl || '',
    HEADER_TEXT: tenantSettings?.header_text || '',
    FOOTER_TEXT: tenantSettings?.footer_text || '',
    PRIMARY_COLOR: tenantSettings?.primary_color || data.brandColor || '#0369a1',
    SECONDARY_COLOR: tenantSettings?.secondary_color || '#64748b',
    EMPLOYEE_NAME: data.employeeName,
    DEPARTMENT: data.department || 'N/A',
    MONTH_NAME: MONTHS[data.month - 1],
    MONTH_SHORT: MONTHS_SHORT[data.month - 1],
    YEAR: String(data.year),
    WORKING_DAYS: String(data.workingDays),
    PRESENT_DAYS: String(data.presentDays),
    LEAVE_DAYS: String(data.leaveDays),
    LOP_DAYS: String(data.lopDays || 0),
    BASIC_SALARY: formatCurrency(data.basicSalary),
    HRA: formatCurrency(data.hra),
    SPECIAL_ALLOWANCE: formatCurrency(data.specialAllowance),
    OTHER_ALLOWANCES: formatCurrency(data.otherAllowances),
    GROSS_SALARY: formatCurrency(data.grossSalary),
    DEDUCTION_ROWS: buildDeductionRows(data),
    TOTAL_DEDUCTIONS: formatCurrency(data.totalDeductions),
    NET_SALARY: formatCurrency(data.netSalary),
    NET_IN_WORDS: numberToWords(data.netSalary),
    PF_EMPLOYER: formatCurrency(data.pfEmployer),
    ESI_EMPLOYER: formatCurrency(data.esiEmployer),
    EMPLOYER_CONTRIBUTIONS: (data.pfEmployer > 0 || data.esiEmployer > 0) ? 'true' : '',
    GENERATED_DATE: new Date().toLocaleDateString('en-IN'),
  };
}

// Fallback built-in template (the original)
const FALLBACK_TEMPLATE = `<div style="max-width:800px;margin:0 auto;border:2px solid {{PRIMARY_COLOR}};font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;">
  <div style="background:{{PRIMARY_COLOR}};color:white;padding:24px;text-align:center;">
    {{#LOGO}}<img src="{{LOGO}}" alt="Logo" style="max-height:50px;margin-bottom:8px;" />{{/LOGO}}
    <h1 style="font-size:22px;font-weight:700;margin:0;">{{COMPANY_NAME}}</h1>
    <p style="font-size:13px;opacity:0.9;margin:4px 0 0;">Salary Slip</p>
  </div>
  <div style="background:#f0f9ff;padding:12px 24px;text-align:center;font-weight:600;color:{{PRIMARY_COLOR}};border-bottom:1px solid #bae6fd;font-size:14px;">Payslip for {{MONTH_NAME}} {{YEAR}}</div>
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

export default function SalarySlipPDF({ data, open, onOpenChange }: {
  data: SalarySlipData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const slipRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [templateHtml, setTemplateHtml] = useState<string>(FALLBACK_TEMPLATE);
  const [tenantSettings, setTenantSettings] = useState<any>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Fetch template when dialog opens
  useEffect(() => {
    if (open && data) {
      loadTemplate();
    }
  }, [open, data?.companyId]);

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const companyId = data?.companyId;
      if (!companyId) {
        setTemplateHtml(FALLBACK_TEMPLATE);
        setLoadingTemplate(false);
        return;
      }

      const { data: settingsData } = await supabase
        .from('tenant_payslip_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (!settingsData) {
        setTemplateHtml(FALLBACK_TEMPLATE);
        setTenantSettings(null);
        setLoadingTemplate(false);
        return;
      }

      setTenantSettings(settingsData);

      if (settingsData.template_mode === 'custom' && settingsData.custom_template_content) {
        setTemplateHtml(settingsData.custom_template_content);
      } else if (settingsData.template_mode === 'default' && settingsData.selected_platform_template_id) {
        const { data: tplData } = await supabase
          .from('platform_payslip_templates')
          .select('template_content')
          .eq('id', settingsData.selected_platform_template_id)
          .maybeSingle();
        setTemplateHtml(tplData?.template_content || FALLBACK_TEMPLATE);
      } else {
        setTemplateHtml(FALLBACK_TEMPLATE);
      }
    } catch (err) {
      console.error('Failed to load template:', err);
      setTemplateHtml(FALLBACK_TEMPLATE);
    }
    setLoadingTemplate(false);
  };

  const renderedHtml = data
    ? renderPayslipTemplate(templateHtml, buildPlaceholders(data, tenantSettings))
    : '';

  const downloadPDF = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) throw new Error('Popup blocked');

      printWindow.document.write(`<!DOCTYPE html><html><head>
        <title>Salary Slip - ${data.employeeName} - ${MONTHS[data.month - 1]} ${data.year}</title>
        <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Segoe UI', Arial, sans-serif; background: white; padding: 20px; } @media print { body { padding: 0; } @page { margin: 10mm; } }</style>
      </head><body>${renderedHtml}<script>window.onload = function() { window.print(); }</script></body></html>`);
      printWindow.document.close();
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
    setDownloading(false);
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Salary Slip Preview</span>
            <Button size="sm" onClick={downloadPDF} disabled={downloading || loadingTemplate}>
              {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              Download PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loadingTemplate ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div ref={slipRef} className="border rounded-lg overflow-hidden text-sm" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        )}
      </DialogContent>
    </Dialog>
  );
}
