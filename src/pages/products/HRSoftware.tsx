import { Users, Building2, FileText, Shield, BarChart3, UserCheck, Settings, Globe, FolderOpen, Bell } from 'lucide-react';
import ProductPageLayout from './ProductPageLayout';

export default function HRSoftware() {
  return (
    <ProductPageLayout
      title="Complete HR Software"
      tagline="Core HR Platform"
      description="A centralized HR platform to manage your entire workforce — from onboarding to offboarding. Automate repetitive tasks, maintain compliance, and give employees a modern self-service experience."
      heroIcon={Users}
      features={[
        { icon: Users, title: 'Employee Directory', description: 'Centralized employee database with profiles, departments, designations, and reporting hierarchies — all searchable and filterable.' },
        { icon: Building2, title: 'Multi-Company Support', description: 'Manage multiple companies under a single platform. Each organization gets isolated data, branding, and settings.' },
        { icon: FileText, title: 'Document Management', description: 'Store and organize employee documents securely — offer letters, IDs, certificates, and more with version control.' },
        { icon: Shield, title: 'Role-Based Access', description: 'Granular permissions for Admin, HR, Manager, Payroll, and Employee roles. Control who sees and does what.' },
        { icon: BarChart3, title: 'Analytics & Reports', description: 'Real-time dashboards with headcount analytics, attrition rates, department breakdowns, and custom reports.' },
        { icon: UserCheck, title: 'Onboarding Workflows', description: 'Invite-based onboarding with automated profile creation, approval flows, and welcome communications.' },
        { icon: Settings, title: 'Company Settings', description: 'Configure work locations, shifts, statutory details (PAN, GST, PF), brand colors, and more from a single panel.' },
        { icon: Globe, title: 'Geofence & Location', description: 'Set up office geofences and track whether employees are punching in from authorized locations.' },
        { icon: FolderOpen, title: 'Audit Trail', description: 'Complete audit logging of every action — who changed what and when — for compliance and accountability.' },
        { icon: Bell, title: 'Smart Notifications', description: 'Automated notifications for pending approvals, birthdays, work anniversaries, and important announcements.' },
      ]}
      howItWorks={[
        { step: 1, title: 'Set Up Your Organization', description: 'Create your company profile, configure departments, designations, shifts, and invite your team using unique invite codes.' },
        { step: 2, title: 'Onboard Employees', description: 'Employees sign up, complete their profiles, upload documents, and get assigned roles — all through a guided self-service flow.' },
        { step: 3, title: 'Manage Day-to-Day', description: 'Handle attendance, leaves, approvals, announcements, and payroll from a unified dashboard. Managers get real-time visibility into their teams.' },
        { step: 4, title: 'Analyze & Optimize', description: 'Use built-in analytics to track workforce metrics, generate compliance reports, and make data-driven HR decisions.' },
      ]}
      benefits={[
        'Eliminate spreadsheets and manual HR processes',
        'Reduce onboarding time by up to 70%',
        'Ensure 100% statutory compliance with auto-calculated deductions',
        'Give employees self-service access to payslips, leaves, and documents',
        'Real-time visibility across all locations and departments',
        'Secure, role-based access prevents unauthorized data exposure',
        'Mobile-first design works on any device',
        'Scales from 10 to 10,000+ employees seamlessly',
      ]}
    />
  );
}
