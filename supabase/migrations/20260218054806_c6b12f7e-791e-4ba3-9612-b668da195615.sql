
-- Compensation & Payroll tables
CREATE TABLE public.salary_structures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  hra NUMERIC(12,2) DEFAULT 0,
  da NUMERIC(12,2) DEFAULT 0,
  special_allowance NUMERIC(12,2) DEFAULT 0,
  other_allowances NUMERIC(12,2) DEFAULT 0,
  pf_deduction NUMERIC(12,2) DEFAULT 0,
  tax_deduction NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.payroll_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  user_id UUID NOT NULL,
  working_days INTEGER DEFAULT 0,
  present_days INTEGER DEFAULT 0,
  leave_days INTEGER DEFAULT 0,
  overtime_hours NUMERIC(6,2) DEFAULT 0,
  gross_salary NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_salary NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Employee Engagement tables
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  created_by UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open',
  admin_response TEXT,
  responded_by UUID,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_awards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  award_title TEXT NOT NULL,
  description TEXT,
  awarded_by UUID NOT NULL,
  award_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_awards ENABLE ROW LEVEL SECURITY;

-- Salary structures: developers/admins can manage, employees see own
CREATE POLICY "Developers can manage all salary structures" ON public.salary_structures
  FOR ALL USING (public.is_developer() OR public.is_admin());

CREATE POLICY "Employees can view own salary" ON public.salary_structures
  FOR SELECT USING (auth.uid() = user_id);

-- Payroll runs: developers/admins can manage, employees see own
CREATE POLICY "Developers can manage all payroll runs" ON public.payroll_runs
  FOR ALL USING (public.is_developer() OR public.is_admin());

CREATE POLICY "Employees can view own payroll" ON public.payroll_runs
  FOR SELECT USING (auth.uid() = user_id);

-- Announcements: developers/admins can manage, all authenticated can view active
CREATE POLICY "Developers can manage announcements" ON public.announcements
  FOR ALL USING (public.is_developer() OR public.is_admin());

CREATE POLICY "All users can view active announcements" ON public.announcements
  FOR SELECT USING (is_active = true);

-- Feedback: developers/admins can view all, employees manage own
CREATE POLICY "Developers can manage all feedback" ON public.employee_feedback
  FOR ALL USING (public.is_developer() OR public.is_admin());

CREATE POLICY "Employees can manage own feedback" ON public.employee_feedback
  FOR ALL USING (auth.uid() = user_id);

-- Awards: developers/admins can manage, employees see own
CREATE POLICY "Developers can manage all awards" ON public.employee_awards
  FOR ALL USING (public.is_developer() OR public.is_admin());

CREATE POLICY "Employees can view own awards" ON public.employee_awards
  FOR SELECT USING (auth.uid() = user_id);
