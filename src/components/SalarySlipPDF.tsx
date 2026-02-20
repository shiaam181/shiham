import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface SalarySlipData {
  employeeName: string;
  department: string | null;
  email: string;
  month: number;
  year: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  overtimeHours: number;
  basicSalary: number;
  hra: number;
  da: number;
  specialAllowance: number;
  otherAllowances: number;
  pfDeduction: number;
  taxDeduction: number;
  otherDeductions: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  companyName?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

export default function SalarySlipPDF({ data, open, onOpenChange }: {
  data: SalarySlipData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const slipRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const downloadPDF = async () => {
    if (!slipRef.current || !data) return;
    setDownloading(true);

    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Popup blocked');
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Salary Slip - ${data.employeeName} - ${MONTHS[data.month - 1]} ${data.year}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: white; padding: 20px; }
            .slip { max-width: 800px; margin: 0 auto; border: 2px solid #0369a1; }
            .header { background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); color: white; padding: 24px; text-align: center; }
            .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
            .header p { font-size: 13px; opacity: 0.9; }
            .period { background: #f0f9ff; padding: 12px 24px; text-align: center; font-weight: 600; color: #0369a1; border-bottom: 1px solid #bae6fd; font-size: 14px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #e2e8f0; }
            .info-item { padding: 10px 24px; display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
            .info-item:nth-child(odd) { border-right: 1px solid #e2e8f0; }
            .info-label { color: #64748b; }
            .info-value { font-weight: 600; }
            .section-title { background: #f8fafc; padding: 10px 24px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0; }
            .section-title.earnings { color: #15803d; border-left: 4px solid #16a34a; }
            .section-title.deductions { color: #dc2626; border-left: 4px solid #dc2626; }
            .row { display: flex; justify-content: space-between; padding: 8px 24px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
            .row:hover { background: #fafafa; }
            .row .label { color: #475569; }
            .row .value { font-weight: 500; }
            .total-row { display: flex; justify-content: space-between; padding: 12px 24px; font-size: 14px; font-weight: 700; border-top: 2px solid #e2e8f0; background: #f8fafc; }
            .total-row.earnings .value { color: #15803d; }
            .total-row.deductions .value { color: #dc2626; }
            .net-pay { background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
            .net-pay .label { font-size: 16px; font-weight: 700; }
            .net-pay .value { font-size: 22px; font-weight: 800; }
            .words { padding: 12px 24px; font-size: 12px; color: #64748b; font-style: italic; border-top: 1px solid #e2e8f0; }
            .footer { padding: 20px 24px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
            .signature { margin-top: 40px; padding: 0 24px 20px; display: flex; justify-content: space-between; }
            .sig-block { text-align: center; }
            .sig-line { width: 160px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 12px; color: #64748b; }
            @media print { body { padding: 0; } .slip { border: none; } @page { margin: 10mm; } }
          </style>
        </head>
        <body>
          <div class="slip">
            <div class="header">
              <h1>${data.companyName || 'Company'}</h1>
              <p>Salary Slip</p>
            </div>
            <div class="period">Payslip for ${MONTHS[data.month - 1]} ${data.year}</div>
            <div class="info-grid">
              <div class="info-item"><span class="info-label">Employee Name</span><span class="info-value">${data.employeeName}</span></div>
              <div class="info-item"><span class="info-label">Department</span><span class="info-value">${data.department || 'N/A'}</span></div>
              <div class="info-item"><span class="info-label">Email</span><span class="info-value">${data.email}</span></div>
              <div class="info-item"><span class="info-label">Pay Period</span><span class="info-value">${MONTHS[data.month - 1]} ${data.year}</span></div>
              <div class="info-item"><span class="info-label">Working Days</span><span class="info-value">${data.workingDays}</span></div>
              <div class="info-item"><span class="info-label">Present Days</span><span class="info-value">${data.presentDays}</span></div>
              <div class="info-item"><span class="info-label">Leave Days</span><span class="info-value">${data.leaveDays}</span></div>
              <div class="info-item"><span class="info-label">Overtime Hours</span><span class="info-value">${data.overtimeHours}</span></div>
            </div>
            <div class="section-title earnings">Earnings</div>
            <div class="row"><span class="label">Basic Salary</span><span class="value">${formatCurrency(data.basicSalary)}</span></div>
            <div class="row"><span class="label">House Rent Allowance (HRA)</span><span class="value">${formatCurrency(data.hra)}</span></div>
            <div class="row"><span class="label">Dearness Allowance (DA)</span><span class="value">${formatCurrency(data.da)}</span></div>
            <div class="row"><span class="label">Special Allowance</span><span class="value">${formatCurrency(data.specialAllowance)}</span></div>
            <div class="row"><span class="label">Other Allowances</span><span class="value">${formatCurrency(data.otherAllowances)}</span></div>
            <div class="total-row earnings"><span class="label">Total Earnings</span><span class="value">${formatCurrency(data.grossSalary)}</span></div>
            <div class="section-title deductions">Deductions</div>
            <div class="row"><span class="label">Provident Fund (PF)</span><span class="value">${formatCurrency(data.pfDeduction)}</span></div>
            <div class="row"><span class="label">Income Tax (TDS)</span><span class="value">${formatCurrency(data.taxDeduction)}</span></div>
            <div class="row"><span class="label">Other Deductions</span><span class="value">${formatCurrency(data.otherDeductions)}</span></div>
            <div class="total-row deductions"><span class="label">Total Deductions</span><span class="value">${formatCurrency(data.totalDeductions)}</span></div>
            <div class="net-pay"><span class="label">Net Pay</span><span class="value">${formatCurrency(data.netSalary)}</span></div>
            <div class="words"><strong>In Words:</strong> ${numberToWords(data.netSalary)}</div>
            <div class="signature">
              <div class="sig-block"><div class="sig-line">Employee Signature</div></div>
              <div class="sig-block"><div class="sig-line">Authorized Signatory</div></div>
            </div>
            <div class="footer">
              <span>This is a computer-generated document. No signature is required.</span>
              <span>Generated on ${new Date().toLocaleDateString('en-IN')}</span>
            </div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
      `);
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
            <Button size="sm" onClick={downloadPDF} disabled={downloading}>
              {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              Download PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div ref={slipRef} className="border rounded-lg overflow-hidden text-sm">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-5 text-center">
            <h2 className="text-lg font-bold">{data.companyName || 'Company'}</h2>
            <p className="text-xs opacity-90">Salary Slip</p>
          </div>

          <div className="bg-primary/5 text-center py-2 text-xs font-semibold text-primary border-b">
            Payslip for {MONTHS[data.month - 1]} {data.year}
          </div>

          {/* Employee Info */}
          <div className="grid grid-cols-2 text-xs border-b">
            {[
              ['Employee', data.employeeName],
              ['Department', data.department || 'N/A'],
              ['Working Days', data.workingDays],
              ['Present Days', data.presentDays],
              ['Leave Days', data.leaveDays],
              ['Overtime', `${data.overtimeHours} hrs`],
            ].map(([label, val], i) => (
              <div key={i} className={`flex justify-between p-2 border-b border-border/50 ${i % 2 === 0 ? 'border-r' : ''}`}>
                <span className="text-muted-foreground">{label as string}</span>
                <span className="font-medium">{String(val)}</span>
              </div>
            ))}
          </div>

          {/* Earnings */}
          <div className="bg-success/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-success border-b border-l-4 border-l-success">
            Earnings
          </div>
          {[
            ['Basic Salary', data.basicSalary],
            ['HRA', data.hra],
            ['DA', data.da],
            ['Special Allowance', data.specialAllowance],
            ['Other Allowances', data.otherAllowances],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between px-4 py-1.5 text-xs border-b border-border/30">
              <span className="text-muted-foreground">{label as string}</span>
              <span>{formatCurrency(Number(val))}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-2 text-xs font-bold border-b border-t-2 bg-muted/30">
            <span>Total Earnings</span>
            <span className="text-success">{formatCurrency(data.grossSalary)}</span>
          </div>

          {/* Deductions */}
          <div className="bg-destructive/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive border-b border-l-4 border-l-destructive">
            Deductions
          </div>
          {[
            ['Provident Fund', data.pfDeduction],
            ['Income Tax', data.taxDeduction],
            ['Other Deductions', data.otherDeductions],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between px-4 py-1.5 text-xs border-b border-border/30">
              <span className="text-muted-foreground">{label as string}</span>
              <span>{formatCurrency(Number(val))}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-2 text-xs font-bold border-b border-t-2 bg-muted/30">
            <span>Total Deductions</span>
            <span className="text-destructive">{formatCurrency(data.totalDeductions)}</span>
          </div>

          {/* Net Pay */}
          <div className="bg-primary text-primary-foreground flex justify-between items-center px-4 py-3">
            <span className="font-bold">Net Pay</span>
            <span className="text-xl font-extrabold">{formatCurrency(data.netSalary)}</span>
          </div>

          <div className="px-4 py-2 text-[10px] text-muted-foreground italic border-t">
            <strong>In Words:</strong> {numberToWords(data.netSalary)}
          </div>

          <div className="flex justify-between px-4 py-3 text-[10px] text-muted-foreground border-t">
            <span>Computer generated — no signature required</span>
            <span>{new Date().toLocaleDateString('en-IN')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
