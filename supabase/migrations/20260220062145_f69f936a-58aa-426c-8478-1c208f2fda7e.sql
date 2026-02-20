-- Allow payroll team to also view processed payroll entries (not just approved)
DROP POLICY IF EXISTS "Payroll team can view approved payroll" ON public.payroll_runs;
CREATE POLICY "Payroll team can view payroll"
ON public.payroll_runs
FOR SELECT
USING (is_payroll_team() AND status IN ('approved', 'processed'));

-- Allow payroll team to update processed payroll too (for corrections)
DROP POLICY IF EXISTS "Payroll team can update approved payroll" ON public.payroll_runs;
CREATE POLICY "Payroll team can update payroll"
ON public.payroll_runs
FOR UPDATE
USING (is_payroll_team() AND status IN ('approved', 'processed'));