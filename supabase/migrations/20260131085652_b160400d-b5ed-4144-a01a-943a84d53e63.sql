-- Fix: Scope admin photo access to their own company only
-- Keep developers with full access for system management

-- First drop the existing combined policy
DROP POLICY IF EXISTS "Admins and developers can view all photos" ON storage.objects;

-- Create separate policy for admins (company-scoped)
CREATE POLICY "Admins can view their company photos" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'employee-photos' AND
  public.is_admin() AND
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    JOIN public.profiles photo_owner ON photo_owner.user_id::text = (storage.foldername(name))[1]
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = photo_owner.company_id
  )
);

-- Create separate policy for developers (full access for system management)
CREATE POLICY "Developers can view all photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'employee-photos' AND public.is_developer());