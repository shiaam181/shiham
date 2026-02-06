-- Allow company Owners to view and manage employee profiles within their own company
-- This fixes Employee Management / Admin views showing only the logged-in owner.

-- Profiles table already exists; ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Owners can view profiles in their company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Owners can view company profiles'
  ) THEN
    CREATE POLICY "Owners can view company profiles"
    ON public.profiles
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles me
        WHERE me.user_id = auth.uid()
          AND me.company_id = public.profiles.company_id
          AND public.has_role(auth.uid(), 'owner'::public.app_role)
      )
    );
  END IF;
END $$;

-- Owners can update profiles in their company (for department/position, activation, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Owners can update company profiles'
  ) THEN
    CREATE POLICY "Owners can update company profiles"
    ON public.profiles
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles me
        WHERE me.user_id = auth.uid()
          AND me.company_id = public.profiles.company_id
          AND public.has_role(auth.uid(), 'owner'::public.app_role)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.profiles me
        WHERE me.user_id = auth.uid()
          AND me.company_id = public.profiles.company_id
          AND public.has_role(auth.uid(), 'owner'::public.app_role)
      )
    );
  END IF;
END $$;
