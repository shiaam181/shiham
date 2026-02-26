
-- Leave balances - HR admin manage policy (the SELECT one already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leave_balances' AND policyname = 'HR admins can manage leave balances'
  ) THEN
    CREATE POLICY "HR admins can manage leave balances"
      ON public.leave_balances FOR ALL
      USING (is_admin() OR is_hr() OR has_role(auth.uid(), 'developer'::app_role))
      WITH CHECK (is_admin() OR is_hr() OR has_role(auth.uid(), 'developer'::app_role));
  END IF;
END $$;
