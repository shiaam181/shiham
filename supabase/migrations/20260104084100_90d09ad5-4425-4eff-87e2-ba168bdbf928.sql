-- Update the public access policy to include password_login_enabled
DROP POLICY IF EXISTS "Public can read auth settings" ON public.system_settings;

CREATE POLICY "Public can read auth settings" 
ON public.system_settings 
FOR SELECT 
USING (key = ANY (ARRAY['google_signin_enabled'::text, 'phone_otp_enabled'::text, 'email_otp_enabled'::text, 'password_login_enabled'::text, 'show_marketing_landing_page'::text]));