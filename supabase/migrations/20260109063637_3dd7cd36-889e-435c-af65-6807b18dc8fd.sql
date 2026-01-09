-- Tighten audit_logs INSERT policy (avoid overly permissive WITH CHECK (true))
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'Users can insert own audit logs'
  ) THEN
    CREATE POLICY "Users can insert own audit logs"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;