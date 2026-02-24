import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Building2, Users, Clock, Calendar, Scale, Receipt, Wallet,
  CheckCircle2, Circle, ArrowRight, Shield,
} from 'lucide-react';

interface StepStatus {
  companySettings: boolean;
  shifts: boolean;
  holidays: boolean;
  weekOffs: boolean;
  employees: boolean;
  leavePolicies: boolean;
  statutoryProfiles: boolean;
  salaryStructures: boolean;
}

export default function SetupGuide() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StepStatus>({
    companySettings: false, shifts: false, holidays: false, weekOffs: false,
    employees: false, leavePolicies: false, statutoryProfiles: false, salaryStructures: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const [companyRes, shiftRes, holidayRes, weekOffRes, empRes, leavePolRes, statRes, salaryRes] = await Promise.all([
      supabase.from('company_settings').select('id').limit(1),
      supabase.from('shifts').select('id').limit(1),
      supabase.from('holidays').select('id').limit(1),
      supabase.from('week_offs').select('id').limit(1),
      supabase.from('profiles').select('id').eq('is_active', true).limit(2),
      supabase.from('leave_policies').select('id').limit(1),
      supabase.from('statutory_profiles').select('id').limit(1),
      supabase.from('salary_structures').select('id').eq('is_active', true).limit(1),
    ]);

    setStatus({
      companySettings: (companyRes.data?.length || 0) > 0,
      shifts: (shiftRes.data?.length || 0) > 0,
      holidays: (holidayRes.data?.length || 0) > 0,
      weekOffs: (weekOffRes.data?.length || 0) > 0,
      employees: (empRes.data?.length || 0) > 1,
      leavePolicies: (leavePolRes.data?.length || 0) > 0,
      statutoryProfiles: (statRes.data?.length || 0) > 0,
      salaryStructures: (salaryRes.data?.length || 0) > 0,
    });
    setLoading(false);
  };

  const steps = [
    {
      key: 'companySettings' as keyof StepStatus,
      icon: Building2,
      title: 'Company Settings',
      description: 'Configure company name, address, timezone, and contact details.',
      path: '/admin/settings',
      category: 'Foundation',
    },
    {
      key: 'shifts' as keyof StepStatus,
      icon: Clock,
      title: 'Shift Templates',
      description: 'Define work shifts with start/end times and grace periods.',
      path: '/admin/shifts',
      category: 'Foundation',
    },
    {
      key: 'holidays' as keyof StepStatus,
      icon: Calendar,
      title: 'Holiday Calendar',
      description: 'Add public holidays and company-specific days off.',
      path: '/admin/holidays',
      category: 'Foundation',
    },
    {
      key: 'weekOffs' as keyof StepStatus,
      icon: Calendar,
      title: 'Week Off Configuration',
      description: 'Set global and employee-specific weekly off days.',
      path: '/admin/weekoffs',
      category: 'Foundation',
    },
    {
      key: 'employees' as keyof StepStatus,
      icon: Users,
      title: 'Add Employees',
      description: 'Invite employees or add them manually with department and designation.',
      path: '/admin/employees',
      category: 'People',
    },
    {
      key: 'leavePolicies' as keyof StepStatus,
      icon: Receipt,
      title: 'Leave Policies',
      description: 'Configure leave types (CL/SL/EL), quotas, accrual, and carry-forward rules.',
      path: '/leave-policies',
      category: 'Policies',
    },
    {
      key: 'statutoryProfiles' as keyof StepStatus,
      icon: Scale,
      title: 'Statutory Compliance',
      description: 'Set up PF, ESI, and Professional Tax for employees.',
      path: '/compliance',
      category: 'Policies',
    },
    {
      key: 'salaryStructures' as keyof StepStatus,
      icon: Wallet,
      title: 'Salary Structures',
      description: 'Define salary components (Basic, HRA, DA, allowances) for each employee.',
      path: '/payroll',
      category: 'Payroll',
    },
  ];

  const completedCount = Object.values(status).filter(Boolean).length;
  const totalSteps = steps.length;
  const progress = Math.round((completedCount / totalSteps) * 100);

  const categories = ['Foundation', 'People', 'Policies', 'Payroll'];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Setup Guide
          </h1>
          <p className="text-sm text-muted-foreground">Complete these steps to configure your HRMS</p>
        </div>

        {/* Progress */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{completedCount}/{totalSteps} steps completed</span>
            <Badge variant={progress === 100 ? 'default' : 'secondary'}>{progress}%</Badge>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </Card>

        {/* Steps by category */}
        {categories.map(cat => (
          <div key={cat} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat}</h2>
            {steps.filter(s => s.category === cat).map(step => (
              <Card key={step.key} className={`transition-colors ${status[step.key] ? 'border-primary/30 bg-primary/5' : ''}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${status[step.key] ? 'bg-primary/10' : 'bg-muted'}`}>
                    {status[step.key]
                      ? <CheckCircle2 className="w-5 h-5 text-primary" />
                      : <step.icon className="w-5 h-5 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={status[step.key] ? 'outline' : 'default'}
                    onClick={() => navigate(step.path)}
                  >
                    {status[step.key] ? 'Review' : 'Configure'}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </main>
    </AppLayout>
  );
}
