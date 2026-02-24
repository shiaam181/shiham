
-- Helper functions for new roles
CREATE OR REPLACE FUNCTION public.is_hr()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('hr'::public.app_role, 'admin'::public.app_role, 'developer'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('manager'::public.app_role, 'admin'::public.app_role, 'developer'::public.app_role)
  )
$$;

-- Statutory profiles table
CREATE TABLE public.statutory_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  pf_applicable boolean NOT NULL DEFAULT true,
  uan_number text,
  pf_number text,
  pf_wage_ceiling numeric DEFAULT 15000,
  pf_employee_rate numeric DEFAULT 12,
  pf_employer_rate numeric DEFAULT 12,
  eps_rate numeric DEFAULT 8.33,
  edli_rate numeric DEFAULT 0.5,
  pf_admin_charges_rate numeric DEFAULT 0.5,
  esi_applicable boolean NOT NULL DEFAULT false,
  esi_number text,
  esi_employee_rate numeric DEFAULT 0.75,
  esi_employer_rate numeric DEFAULT 3.25,
  esi_wage_ceiling numeric DEFAULT 21000,
  pt_applicable boolean NOT NULL DEFAULT false,
  pt_state text,
  lwf_applicable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.statutory_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own statutory profile" ON public.statutory_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HR admins can manage statutory profiles" ON public.statutory_profiles FOR ALL
  USING ((is_admin() OR is_hr()) AND (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role)))
  WITH CHECK ((is_admin() OR is_hr()) AND (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role)));
CREATE POLICY "Developers can manage all statutory profiles" ON public.statutory_profiles FOR ALL USING (has_role(auth.uid(), 'developer'::app_role));
CREATE POLICY "Payroll team can view statutory profiles" ON public.statutory_profiles FOR SELECT USING (is_payroll_team());

CREATE TRIGGER update_statutory_profiles_updated_at BEFORE UPDATE ON public.statutory_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Professional Tax slabs
CREATE TABLE public.professional_tax_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  min_salary numeric NOT NULL DEFAULT 0,
  max_salary numeric,
  monthly_tax numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.professional_tax_slabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view PT slabs" ON public.professional_tax_slabs FOR SELECT USING (true);
CREATE POLICY "Admins can manage PT slabs" ON public.professional_tax_slabs FOR ALL
  USING (is_admin() OR is_hr() OR has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (is_admin() OR is_hr() OR has_role(auth.uid(), 'developer'::app_role));

-- Add company statutory fields
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS pan_number text,
ADD COLUMN IF NOT EXISTS tan_number text,
ADD COLUMN IF NOT EXISTS gst_number text,
ADD COLUMN IF NOT EXISTS pf_registration_number text,
ADD COLUMN IF NOT EXISTS esi_registration_number text,
ADD COLUMN IF NOT EXISTS pt_registration_number text,
ADD COLUMN IF NOT EXISTS legal_name text,
ADD COLUMN IF NOT EXISTS registered_address text,
ADD COLUMN IF NOT EXISTS pay_cycle text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS pay_day integer DEFAULT 1;

-- Add employee extended fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS manager_id uuid,
ADD COLUMN IF NOT EXISTS employee_code text,
ADD COLUMN IF NOT EXISTS date_of_joining date,
ADD COLUMN IF NOT EXISTS designation text,
ADD COLUMN IF NOT EXISTS work_location text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_ifsc text,
ADD COLUMN IF NOT EXISTS bank_branch text;

-- Add statutory deduction columns to payroll_runs
ALTER TABLE public.payroll_runs
ADD COLUMN IF NOT EXISTS pf_employee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pf_employer numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS esi_employee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS esi_employer numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS professional_tax numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tds numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_deductions_detail jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS basic_salary numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS hra numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS special_allowance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_allowances numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS lop_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_by uuid;

-- Leave balances
CREATE TABLE public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'casual',
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  opening_balance numeric NOT NULL DEFAULT 0,
  accrued numeric NOT NULL DEFAULT 0,
  used numeric NOT NULL DEFAULT 0,
  carry_forward numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, leave_type, year)
);
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own leave balances" ON public.leave_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HR admins can manage leave balances" ON public.leave_balances FOR ALL
  USING ((is_admin() OR is_hr()) AND (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role)))
  WITH CHECK ((is_admin() OR is_hr()) AND (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role)));
CREATE POLICY "Developers can manage all leave balances" ON public.leave_balances FOR ALL USING (has_role(auth.uid(), 'developer'::app_role));
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leave policies per company
CREATE TABLE public.leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  leave_type text NOT NULL,
  annual_quota numeric NOT NULL DEFAULT 12,
  monthly_accrual numeric NOT NULL DEFAULT 1,
  carry_forward_limit numeric DEFAULT 0,
  encashment_allowed boolean DEFAULT false,
  is_paid boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, leave_type)
);
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view leave policies" ON public.leave_policies FOR SELECT USING (true);
CREATE POLICY "HR admins can manage leave policies" ON public.leave_policies FOR ALL
  USING (is_admin() OR is_hr() OR has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (is_admin() OR is_hr() OR has_role(auth.uid(), 'developer'::app_role));
CREATE TRIGGER update_leave_policies_updated_at BEFORE UPDATE ON public.leave_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Regularization requests
CREATE TABLE public.regularization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  requested_check_in timestamptz,
  requested_check_out timestamptz,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.regularization_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own regularizations" ON public.regularization_requests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Managers can view team regularizations" ON public.regularization_requests FOR SELECT
  USING (is_manager() AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = regularization_requests.user_id AND p.manager_id = auth.uid()));
CREATE POLICY "Managers can update team regularizations" ON public.regularization_requests FOR UPDATE
  USING (is_manager() AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = regularization_requests.user_id AND p.manager_id = auth.uid()));
CREATE POLICY "HR admins can manage company regularizations" ON public.regularization_requests FOR ALL
  USING ((is_admin() OR is_hr()) AND (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role)));
CREATE POLICY "Developers can manage all regularizations" ON public.regularization_requests FOR ALL USING (has_role(auth.uid(), 'developer'::app_role));
CREATE TRIGGER update_regularization_requests_updated_at BEFORE UPDATE ON public.regularization_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default PT slabs for Indian states
INSERT INTO public.professional_tax_slabs (state, min_salary, max_salary, monthly_tax) VALUES
('Maharashtra', 0, 7500, 0),
('Maharashtra', 7501, 10000, 175),
('Maharashtra', 10001, NULL, 200),
('Karnataka', 0, 15000, 0),
('Karnataka', 15001, NULL, 200),
('Tamil Nadu', 0, 21000, 0),
('Tamil Nadu', 21001, 30000, 135),
('Tamil Nadu', 30001, 45000, 315),
('Tamil Nadu', 45001, 60000, 690),
('Tamil Nadu', 60001, 75000, 1025),
('Tamil Nadu', 75001, NULL, 1250),
('Andhra Pradesh', 0, 15000, 0),
('Andhra Pradesh', 15001, 20000, 150),
('Andhra Pradesh', 20001, NULL, 200),
('Gujarat', 0, 12000, 0),
('Gujarat', 12001, NULL, 200),
('West Bengal', 0, 10000, 0),
('West Bengal', 10001, 15000, 110),
('West Bengal', 15001, 25000, 130),
('West Bengal', 25001, 40000, 150),
('West Bengal', 40001, NULL, 200),
('Telangana', 0, 15000, 0),
('Telangana', 15001, 20000, 150),
('Telangana', 20001, NULL, 200);
