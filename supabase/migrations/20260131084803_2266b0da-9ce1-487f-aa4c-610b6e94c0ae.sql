-- Fix 1: Restrict public company access to only expose safe fields (id, name, slug, logo_url)
-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Anyone can search active companies for registration" ON public.companies;

-- Create a more restrictive policy using a function that returns only safe columns
-- For public registration search, use the edge function instead

-- Fix 2: Add company boundary enforcement to admin role policies
-- Drop existing permissive admin policies
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Create company-scoped admin policies
CREATE POLICY "Admins can view their company roles" 
ON public.user_roles FOR SELECT 
USING (
  public.is_admin() AND EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    JOIN public.profiles target_profile ON target_profile.user_id = user_roles.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = target_profile.company_id
  )
);

CREATE POLICY "Admins can insert roles in their company" 
ON public.user_roles FOR INSERT 
WITH CHECK (
  public.is_admin() AND EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    JOIN public.profiles target_profile ON target_profile.user_id = user_roles.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = target_profile.company_id
  )
);

CREATE POLICY "Admins can delete roles in their company" 
ON public.user_roles FOR DELETE 
USING (
  public.is_admin() AND EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    JOIN public.profiles target_profile ON target_profile.user_id = user_roles.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = target_profile.company_id
  )
);

-- Fix 3: Update system_settings policies to block credential storage
-- First, create a policy that explicitly blocks secret keys
DROP POLICY IF EXISTS "Admins and developers can manage system settings" ON public.system_settings;

-- Recreate with explicit exclusion of credential keys
CREATE POLICY "Admins and developers can manage non-credential settings" 
ON public.system_settings FOR ALL
USING (
  (is_admin() OR is_developer()) 
  AND key NOT IN ('twilio_config', 'resend_config', 'emailjs_config')
)
WITH CHECK (
  (is_admin() OR is_developer()) 
  AND key NOT IN ('twilio_config', 'resend_config', 'emailjs_config')
);

-- Clean up any existing credential records from system_settings
DELETE FROM public.system_settings WHERE key IN ('twilio_config', 'resend_config', 'emailjs_config');