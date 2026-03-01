-- Tighten public exposure on system settings
DROP POLICY IF EXISTS "Public can read auth settings" ON public.system_settings;

CREATE POLICY "Authenticated can read auth settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  key = ANY (
    ARRAY[
      'google_signin_enabled'::text,
      'phone_otp_enabled'::text,
      'email_otp_enabled'::text,
      'password_login_enabled'::text,
      'show_marketing_landing_page'::text,
      'testing_mode_enabled'::text,
      'oauth_phone_verification_enabled'::text,
      'app_only_mode_enabled'::text
    ]
  )
);

-- Provide controlled public read access via whitelisted security-definer function
CREATE OR REPLACE FUNCTION public.get_public_auth_settings()
RETURNS TABLE(key text, value jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.key, s.value
  FROM public.system_settings s
  WHERE s.key = ANY (
    ARRAY[
      'google_signin_enabled'::text,
      'phone_otp_enabled'::text,
      'email_otp_enabled'::text,
      'password_login_enabled'::text,
      'show_marketing_landing_page'::text,
      'testing_mode_enabled'::text,
      'oauth_phone_verification_enabled'::text,
      'app_only_mode_enabled'::text
    ]
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_auth_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_auth_settings() TO authenticated;

-- Remove permissive client-side audit log insertion path
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;