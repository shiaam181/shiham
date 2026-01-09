DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companies'
      AND policyname = 'Developers can delete companies'
  ) THEN
    CREATE POLICY "Developers can delete companies"
    ON public.companies
    FOR DELETE
    USING (has_role(auth.uid(), 'developer'::app_role));
  END IF;
END
$$;