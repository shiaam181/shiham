
-- Fix: Allow owners to manage payroll_runs (currently only admin/developer)
DROP POLICY IF EXISTS "Developers can manage all payroll runs" ON public.payroll_runs;
CREATE POLICY "Admins owners developers can manage payroll runs"
  ON public.payroll_runs
  FOR ALL
  TO authenticated
  USING (is_developer() OR is_admin() OR is_owner() OR is_hr())
  WITH CHECK (is_developer() OR is_admin() OR is_owner() OR is_hr());

-- Also fix salary_structures for owners
DROP POLICY IF EXISTS "Developers can manage all salary structures" ON public.salary_structures;
CREATE POLICY "Admins owners developers can manage salary structures"
  ON public.salary_structures
  FOR ALL
  TO authenticated
  USING (is_developer() OR is_admin() OR is_owner() OR is_hr())
  WITH CHECK (is_developer() OR is_admin() OR is_owner() OR is_hr());
