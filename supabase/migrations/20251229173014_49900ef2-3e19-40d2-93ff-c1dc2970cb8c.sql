-- Create function to check if user is developer
CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'developer'
  )
$$;

-- Update company_settings policy to allow developer access
DROP POLICY IF EXISTS "Admins can manage company settings" ON public.company_settings;
CREATE POLICY "Admins and developers can manage company settings" 
ON public.company_settings 
FOR ALL 
USING (is_admin() OR is_developer());

-- Create policy for developers to manage user roles
CREATE POLICY "Developers can view all user roles"
ON public.user_roles
FOR SELECT
USING (is_developer() OR user_id = auth.uid());

CREATE POLICY "Developers can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (is_developer());

CREATE POLICY "Developers can update user roles"
ON public.user_roles
FOR UPDATE
USING (is_developer());

CREATE POLICY "Developers can delete user roles"
ON public.user_roles
FOR DELETE
USING (is_developer());