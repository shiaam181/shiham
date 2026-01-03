-- Fix security issue: Restrict system_settings to authenticated users only
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;

CREATE POLICY "Authenticated users can read system settings" 
ON public.system_settings 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Ensure admins/developers can manage system settings
DROP POLICY IF EXISTS "Admins and developers can manage system settings" ON public.system_settings;

CREATE POLICY "Admins and developers can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'developer')
  )
);

-- Fix security: Add explicit auth check to profiles table policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and developers can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins and developers can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'developer')
  )
);

-- Fix security: Ensure attendance policies have proper auth checks
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;

CREATE POLICY "Users can view own attendance" 
ON public.attendance 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins and developers can view all attendance" 
ON public.attendance 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'developer')
  )
);