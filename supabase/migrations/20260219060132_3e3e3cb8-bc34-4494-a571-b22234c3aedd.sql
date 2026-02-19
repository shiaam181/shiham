
-- Create the function using text comparison instead of enum cast
CREATE OR REPLACE FUNCTION public.is_payroll_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text = 'payroll_team'
  )
$$;

-- Update payroll_runs RLS to allow payroll_team to view approved payroll
CREATE POLICY "Payroll team can view approved payroll"
ON public.payroll_runs
FOR SELECT
USING (is_payroll_team() AND status = 'approved');

-- Allow payroll team to update status (mark as processed/paid)
CREATE POLICY "Payroll team can update approved payroll"
ON public.payroll_runs
FOR UPDATE
USING (is_payroll_team() AND status = 'approved');

-- Allow payroll team to view salary structures
CREATE POLICY "Payroll team can view salary structures"
ON public.salary_structures
FOR SELECT
USING (is_payroll_team());

-- Allow payroll team to view profiles for name lookups
CREATE POLICY "Payroll team can view profiles"
ON public.profiles
FOR SELECT
USING (is_payroll_team());
