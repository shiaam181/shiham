-- Update RLS policy to allow unauthenticated users to read google_signin_enabled
DROP POLICY IF EXISTS "Public can read auth settings" ON public.system_settings;

CREATE POLICY "Public can read auth settings" 
ON public.system_settings 
FOR SELECT 
USING (key IN ('google_signin_enabled', 'phone_otp_enabled', 'email_otp_enabled', 'show_marketing_landing_page'));