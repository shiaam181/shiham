import { Calendar, ClipboardCheck, Bell, BarChart3, Clock, Users, Settings, FileText, Shield } from 'lucide-react';
import ProductPageLayout from './ProductPageLayout';

export default function LeaveManagement() {
  return (
    <ProductPageLayout
      title="Leave Management"
      tagline="Leave & Absence"
      description="Digitize your entire leave management process — from policy creation to balance tracking. Employees apply, managers approve, and HR gets complete visibility, all in real time."
      heroIcon={Calendar}
      features={[
        { icon: Calendar, title: 'Leave Calendar', description: 'Visual calendar showing who is on leave, upcoming holidays, and team availability at a glance.' },
        { icon: ClipboardCheck, title: 'Apply & Approve', description: 'Employees submit leave requests with reason and dates. Managers receive instant notifications and can approve/reject with one tap.' },
        { icon: Settings, title: 'Custom Leave Policies', description: 'Define unlimited leave types — Casual, Sick, Earned, Compensatory, etc. Set annual quotas, accrual rules, and carry-forward limits.' },
        { icon: BarChart3, title: 'Balance Tracking', description: 'Real-time leave balance dashboard showing opening balance, accrued, used, and remaining days per leave type.' },
        { icon: Bell, title: 'Automated Notifications', description: 'Instant alerts for leave requests, approvals, rejections, and low-balance warnings to both employees and managers.' },
        { icon: Users, title: 'Team View', description: 'Managers see their team\'s leave schedule and can identify potential coverage gaps before approving new requests.' },
        { icon: Clock, title: 'Half-Day & Hourly Leave', description: 'Support for half-day leaves, hourly permissions, and flexible leave durations based on company policy.' },
        { icon: FileText, title: 'Leave Reports', description: 'Comprehensive reports on leave utilization, absence trends, and department-wise leave analytics for HR.' },
        { icon: Shield, title: 'Encashment Rules', description: 'Configure leave encashment policies — which types are encashable, limits, and automatic calculations during payroll.' },
      ]}
      howItWorks={[
        { step: 1, title: 'Configure Leave Policies', description: 'Set up leave types with quotas, accrual rates, carry-forward limits, and encashment rules. Assign policies to teams or the entire company.' },
        { step: 2, title: 'Employee Applies', description: 'Employees check their balance, select dates, add a reason, and submit. The system validates against policy rules and balance automatically.' },
        { step: 3, title: 'Manager Reviews', description: 'Managers receive push notifications, review the request against team availability, and approve or reject with optional comments.' },
        { step: 4, title: 'Auto-Update Balances', description: 'Approved leaves automatically deduct from balance, reflect in attendance, and factor into payroll calculations.' },
      ]}
      benefits={[
        'No more email-based leave requests and spreadsheet tracking',
        'Employees see real-time balances before applying',
        'Managers prevent team understaffing with visibility',
        'Leave deductions auto-sync with payroll for accurate salary processing',
        'Configurable policies for different teams or locations',
        'Holiday calendar integration prevents leaves on company holidays',
        'Complete leave history for audits and compliance',
        'Mobile-friendly — apply and approve from anywhere',
      ]}
    />
  );
}
