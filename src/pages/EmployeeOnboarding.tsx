import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, ChevronRight, ChevronLeft, User, Building2, Landmark, FileText, PartyPopper } from 'lucide-react';

interface StepConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  fields: string[];
}

const STEPS: StepConfig[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Let\'s start with your basic details',
    icon: User,
    fields: ['full_name', 'phone', 'department', 'designation'],
  },
  {
    id: 'work',
    title: 'Work Details',
    description: 'Tell us about your role and work location',
    icon: Building2,
    fields: ['position', 'work_location', 'employee_code'],
  },
  {
    id: 'bank',
    title: 'Bank Details',
    description: 'Required for salary processing',
    icon: Landmark,
    fields: ['bank_name', 'bank_account_number', 'bank_ifsc', 'bank_branch'],
  },
  {
    id: 'complete',
    title: 'All Done!',
    description: 'Your profile is set up',
    icon: PartyPopper,
    fields: [],
  },
];

const DEPARTMENTS = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Support', 'Other'];

export default function EmployeeOnboarding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    department: '',
    designation: '',
    position: '',
    work_location: '',
    employee_code: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_branch: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        department: profile.department || '',
        designation: profile.designation || '',
        position: profile.position || '',
        work_location: profile.work_location || '',
        employee_code: profile.employee_code || '',
        bank_name: profile.bank_name || '',
        bank_account_number: profile.bank_account_number || '',
        bank_ifsc: profile.bank_ifsc || '',
        bank_branch: profile.bank_branch || '',
      });
    }
  }, [profile]);

  const updateField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const getStepCompletion = (step: StepConfig) => {
    if (step.fields.length === 0) return 100;
    const filled = step.fields.filter(f => form[f as keyof typeof form]?.trim());
    return Math.round((filled.length / step.fields.length) * 100);
  };

  const overallProgress = () => {
    const allFields = STEPS.flatMap(s => s.fields);
    const filled = allFields.filter(f => form[f as keyof typeof form]?.trim());
    return Math.round((filled.length / allFields.length) * 100);
  };

  const handleSaveStep = async () => {
    setSaving(true);
    try {
      const stepFields = STEPS[currentStep].fields;
      const updates: Record<string, string | null> = {};
      stepFields.forEach(f => {
        updates[f] = form[f as keyof typeof form]?.trim() || null;
      });

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user!.id);

      if (error) throw error;

      if (currentStep < STEPS.length - 2) {
        setCurrentStep(prev => prev + 1);
      } else {
        setCurrentStep(STEPS.length - 1);
      }
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (refreshProfile) await refreshProfile();
    navigate('/dashboard');
    toast({ title: 'Welcome aboard! 🎉', description: 'Your profile setup is complete.' });
  };

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const progress = overallProgress();

  const renderField = (fieldKey: string) => {
    const value = form[fieldKey as keyof typeof form] || '';
    const label = fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    if (fieldKey === 'department') {
      return (
        <div key={fieldKey} className="space-y-2">
          <Label>{label}</Label>
          <Select value={value} onValueChange={v => updateField(fieldKey, v)}>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div key={fieldKey} className="space-y-2">
        <Label>{label}</Label>
        <Input
          value={value}
          onChange={e => updateField(fieldKey, e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Welcome to the Team!</h1>
          <p className="text-muted-foreground">Complete your profile to get started</p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Profile Completion</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep || (i < STEPS.length - 1 && getStepCompletion(s) === 100);
            return (
              <button
                key={s.id}
                onClick={() => i < STEPS.length - 1 && setCurrentStep(i)}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  isActive ? 'text-primary' : isDone ? 'text-primary/60' : 'text-muted-foreground'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isActive ? 'border-primary bg-primary/10' : isDone ? 'border-primary/60 bg-primary/5' : 'border-muted'
                }`}>
                  {isDone && !isActive ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className="text-xs hidden sm:block">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLastStep ? (
              <div className="text-center py-8 space-y-4">
                <PartyPopper className="h-16 w-16 text-primary mx-auto" />
                <h2 className="text-2xl font-bold text-foreground">You're all set!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Your profile is {progress}% complete. You can always update your details later from your profile settings.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {STEPS.slice(0, -1).map(s => (
                    <Badge key={s.id} variant={getStepCompletion(s) === 100 ? 'default' : 'secondary'}>
                      {s.title}: {getStepCompletion(s)}%
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {step.fields.map(renderField)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          {currentStep > 0 && !isLastStep ? (
            <Button variant="outline" onClick={() => setCurrentStep(prev => prev - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          ) : (
            <div />
          )}

          {isLastStep ? (
            <Button onClick={handleFinish} className="ml-auto">
              Go to Dashboard <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>Skip for now</Button>
              <Button onClick={handleSaveStep} disabled={saving}>
                {saving ? 'Saving...' : (
                  <>Save & Continue <ChevronRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
