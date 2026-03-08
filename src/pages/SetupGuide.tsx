import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen, Building2, Users, Clock, Calendar, Scale, Receipt, Wallet,
  CheckCircle2, ArrowRight, Sparkles, PartyPopper, FileText, MapPin,
  ShieldCheck,
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
  const { profile } = useAuth();
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
  const isComplete = completedCount === totalSteps;

  const categories = ['Foundation', 'People', 'Policies', 'Payroll'];
  const categoryIcons: Record<string, React.ElementType> = {
    Foundation: Building2,
    People: Users,
    Policies: FileText,
    Payroll: Wallet,
  };

  // Find next incomplete step
  const nextStep = steps.find(s => !status[s.key]);

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
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl space-y-5 pb-8">
        {/* Welcome Banner */}
        {!isComplete ? (
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold font-display">
                    Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 👋
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Let's get your HRMS configured. Complete these {totalSteps} steps to unlock the full potential of your platform.
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{completedCount} of {totalSteps} complete</span>
                      <span className="text-primary font-semibold">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2.5" />
                  </div>
                  {nextStep && (
                    <Button size="sm" className="mt-4" onClick={() => navigate(nextStep.path)}>
                      Next: {nextStep.title}
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-success/30 bg-gradient-to-br from-success/5 via-background to-success/10">
            <CardContent className="p-5 sm:p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                <PartyPopper className="w-8 h-8 text-success" />
              </div>
              <h1 className="text-xl font-bold font-display">All Set! 🎉</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Your HRMS is fully configured. Employees can now check in, apply for leaves, and view payslips.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                  Go to Dashboard
                </Button>
                <Button size="sm" onClick={() => navigate('/owner')}>
                  Owner Panel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Steps by category */}
        {categories.map(cat => {
          const catSteps = steps.filter(s => s.category === cat);
          const catComplete = catSteps.filter(s => status[s.key]).length;
          const CatIcon = categoryIcons[cat];

          return (
            <div key={cat} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <CatIcon className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat}</h2>
                </div>
                <Badge variant={catComplete === catSteps.length ? 'default' : 'secondary'} className="text-[10px]">
                  {catComplete}/{catSteps.length}
                </Badge>
              </div>
              {catSteps.map((step, idx) => {
                const done = status[step.key];
                return (
                  <Card
                    key={step.key}
                    className={`transition-all cursor-pointer hover:shadow-sm ${done ? 'border-primary/20 bg-primary/[0.03]' : 'hover:border-border'}`}
                    onClick={() => navigate(step.path)}
                  >
                    <CardContent className="flex items-center gap-3.5 p-3.5 sm:p-4">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${done ? 'bg-primary/10' : 'bg-muted'}`}>
                        {done
                          ? <CheckCircle2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />
                          : <step.icon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-muted-foreground" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm ${done ? 'text-primary' : ''}`}>{step.title}</p>
                          {done && <ShieldCheck className="w-3.5 h-3.5 text-primary/60" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{step.description}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={done ? 'ghost' : 'default'}
                        className="shrink-0 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigate(step.path); }}
                      >
                        {done ? 'Review' : 'Configure'}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </main>
    </AppLayout>
  );
}
