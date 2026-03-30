import { UserCheck, FileText, Clock, Bell, Smartphone, Shield, Download, Settings, MessageSquare } from 'lucide-react';
import ProductPageLayout from './ProductPageLayout';

export default function EmployeeSelfService() {
  return (
    <ProductPageLayout
      title="Employee Self Service"
      tagline="ESS Portal"
      description="Empower employees to manage their own HR needs — view payslips, apply for leaves, update personal info, download documents, and more. Reduce HR workload dramatically."
      heroIcon={UserCheck}
      features={[
        { icon: UserCheck, title: 'Profile Management', description: 'Employees can update their personal details, bank information, emergency contacts, and profile photo without contacting HR.' },
        { icon: FileText, title: 'Payslip Access', description: 'View and download salary slips for any month directly from the dashboard. Professional PDF format with company branding.' },
        { icon: Clock, title: 'Leave Management', description: 'Check leave balances, apply for time off, view leave history, and track approval status — all from one screen.' },
        { icon: Bell, title: 'Notification Center', description: 'Stay updated with company announcements, approval notifications, birthday reminders, and important alerts.' },
        { icon: Smartphone, title: 'Mobile-First Design', description: 'Full-featured mobile experience. Punch in/out, apply leaves, check payslips — everything works on your phone.' },
        { icon: Shield, title: 'Attendance Records', description: 'View personal attendance history, check-in/out times, location details, and monthly attendance summaries.' },
        { icon: Download, title: 'Document Download', description: 'Access uploaded documents like offer letters, company policies, tax forms, and certificates anytime.' },
        { icon: MessageSquare, title: 'HR Assistant Chat', description: 'AI-powered HR chatbot answers common questions about policies, leave balances, and payroll instantly.' },
        { icon: Settings, title: 'Preference Settings', description: 'Set notification preferences, display mode (dark/light), and other personal customizations.' },
      ]}
      howItWorks={[
        { step: 1, title: 'Log In', description: 'Employees log in using email/password or phone OTP. The system detects their role and shows a personalized dashboard.' },
        { step: 2, title: 'View Dashboard', description: 'The employee home screen shows today\'s attendance status, leave balance summary, recent payslips, and pending actions.' },
        { step: 3, title: 'Take Actions', description: 'Apply for leave, mark attendance, update bank details, download payslips, or chat with the HR assistant — all self-service.' },
        { step: 4, title: 'Stay Informed', description: 'Receive push notifications for approvals, announcements, and reminders. Never miss an important HR update.' },
      ]}
      benefits={[
        'Reduce HR helpdesk queries by up to 80%',
        'Employees get instant access to their own data',
        'No more "can you send me my payslip" emails',
        'Mobile-first — works perfectly on any smartphone',
        'AI chatbot handles routine questions 24/7',
        'Secure — employees only see their own data',
        'Reduces manual paperwork and data entry errors',
        'Increases employee satisfaction with modern self-service',
      ]}
    />
  );
}
