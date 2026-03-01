import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMemo } from 'react';

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SAMPLE_DATA: Record<string, string> = {
  COMPANY_NAME: 'Acme Corp',
  LOGO: '',
  HEADER_TEXT: '',
  FOOTER_TEXT: 'Computer generated — no signature required',
  PRIMARY_COLOR: '#0369a1',
  SECONDARY_COLOR: '#64748b',
  EMPLOYEE_NAME: 'John Doe',
  DEPARTMENT: 'Engineering',
  MONTH_NAME: MONTHS_FULL[new Date().getMonth()],
  MONTH_SHORT: MONTHS_SHORT[new Date().getMonth()],
  YEAR: String(new Date().getFullYear()),
  WORKING_DAYS: '22',
  PRESENT_DAYS: '20',
  LEAVE_DAYS: '2',
  LOP_DAYS: '0',
  BASIC_SALARY: '₹25,000.00',
  HRA: '₹10,000.00',
  SPECIAL_ALLOWANCE: '₹5,000.00',
  OTHER_ALLOWANCES: '₹2,000.00',
  GROSS_SALARY: '₹42,000.00',
  TOTAL_DEDUCTIONS: '₹5,200.00',
  NET_SALARY: '₹36,800.00',
  NET_IN_WORDS: 'Thirty Six Thousand Eight Hundred Rupees Only',
  PF_EMPLOYER: '₹1,800.00',
  ESI_EMPLOYER: '₹1,365.00',
  GENERATED_DATE: new Date().toLocaleDateString('en-IN'),
  DEDUCTION_ROWS: `<div style="display:flex;justify-content:space-between;padding:8px 24px;font-size:13px;border-bottom:1px solid #f1f5f9;padding:10px 16px;"><span>Provident Fund (PF)</span><span>₹3,000.00</span></div>
<div style="display:flex;justify-content:space-between;padding:8px 24px;font-size:13px;border-bottom:1px solid #f1f5f9;padding:10px 16px;"><span>ESI</span><span>₹315.00</span></div>
<div style="display:flex;justify-content:space-between;padding:8px 24px;font-size:13px;border-bottom:1px solid #f1f5f9;padding:10px 16px;"><span>Professional Tax</span><span>₹200.00</span></div>
<div style="display:flex;justify-content:space-between;padding:8px 24px;font-size:13px;border-bottom:1px solid #f1f5f9;padding:10px 16px;"><span>Income Tax (TDS)</span><span>₹1,685.00</span></div>`,
};

function renderTemplate(html: string, data: Record<string, string>): string {
  let result = html;

  // Handle conditional sections: {{#KEY}}...{{/KEY}} (show if truthy)
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return data[key] ? content.replace(/\{\{(\w+)\}\}/g, (__, k) => data[k] || '') : '';
  });

  // Handle inverted sections: {{^KEY}}...{{/KEY}} (show if falsy)
  result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return !data[key] ? content.replace(/\{\{(\w+)\}\}/g, (__, k) => data[k] || '') : '';
  });

  // Replace remaining placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');

  return result;
}

export function renderPayslipTemplate(
  templateHtml: string,
  payrollData: Record<string, string>
): string {
  return renderTemplate(templateHtml, payrollData);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateHtml: string;
  overrides?: Record<string, string>;
}

export default function PayslipTemplatePreview({ open, onOpenChange, templateHtml, overrides }: Props) {
  const rendered = useMemo(() => {
    const data = { ...SAMPLE_DATA, ...overrides };
    return renderTemplate(templateHtml, data);
  }, [templateHtml, overrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Template Preview (Sample Data)</DialogTitle>
        </DialogHeader>
        <div
          className="border rounded-lg overflow-hidden"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      </DialogContent>
    </Dialog>
  );
}
