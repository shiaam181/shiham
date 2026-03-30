import { Wallet, Calculator, FileText, Shield, Clock, Download, Lock, BarChart3, IndianRupee, Settings } from 'lucide-react';
import ProductPageLayout from './ProductPageLayout';

export default function PayrollSoftware() {
  return (
    <ProductPageLayout
      title="Payroll Software"
      tagline="Payroll & Compliance"
      description="Automate salary processing, tax calculations, and statutory compliance. Generate payslips, manage deductions, and run payroll for your entire organization in minutes — not days."
      heroIcon={Wallet}
      features={[
        { icon: Calculator, title: 'Auto Salary Calculation', description: 'Automatically compute gross pay, deductions (PF, ESI, PT, TDS), and net salary based on attendance, leaves, and LOP days.' },
        { icon: FileText, title: 'Professional Payslips', description: 'Generate beautifully formatted PDF payslips with your company branding. Employees can download them anytime from their dashboard.' },
        { icon: Shield, title: 'Statutory Compliance', description: 'Built-in PF, ESI, Professional Tax slab management, and TDS calculations. Stay compliant without manual effort.' },
        { icon: Clock, title: 'Overtime Integration', description: 'Overtime hours are automatically pulled from attendance records and factored into salary calculations.' },
        { icon: Lock, title: 'Payroll Locking', description: 'Lock processed payroll to prevent accidental modifications. Full audit trail of who processed and when.' },
        { icon: Download, title: 'Bulk Export', description: 'Export payroll data as CSV or PDF for bank transfers, audits, or integration with accounting software.' },
        { icon: IndianRupee, title: 'Salary Components', description: 'Configure salary structures with Basic, HRA, Special Allowance, and custom components per employee.' },
        { icon: BarChart3, title: 'Payroll Dashboard', description: 'Visual overview of total payroll costs, department-wise breakdowns, and month-over-month trends.' },
        { icon: Settings, title: 'Custom Templates', description: 'Choose from multiple payslip templates or customize your own with your company logo and layout.' },
      ]}
      howItWorks={[
        { step: 1, title: 'Configure Salary Structure', description: 'Set up salary components — Basic, HRA, allowances, and deduction rules. Define statutory parameters like PF rate and PT slabs.' },
        { step: 2, title: 'Run Payroll', description: 'Select the month, review attendance data and leave deductions, then process payroll with one click. The system calculates everything automatically.' },
        { step: 3, title: 'Review & Lock', description: 'Review the computed salaries, make manual adjustments if needed, then lock the payroll to finalize it.' },
        { step: 4, title: 'Distribute Payslips', description: 'Employees receive their payslips on their dashboard. Export bank-ready files for salary disbursement.' },
      ]}
      benefits={[
        'Process payroll for 500+ employees in under 5 minutes',
        'Zero calculation errors with automated statutory compliance',
        'Employees access payslips instantly from their mobile',
        'Overtime and LOP automatically factored in',
        'Full audit trail for every payroll run',
        'Professional, branded payslip PDFs',
        'Supports multiple salary structures within a company',
        'Month-wise payroll cost analytics for budgeting',
      ]}
    />
  );
}
