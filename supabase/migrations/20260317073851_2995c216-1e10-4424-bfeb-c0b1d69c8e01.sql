
-- Add app store redirect settings to system_settings RLS whitelist
-- Update the authenticated read policy to include the new keys
DROP POLICY IF EXISTS "Authenticated users can read non-secret system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read non-secret system settings"
ON public.system_settings FOR SELECT TO public
USING (
  (auth.role() = 'authenticated'::text) AND (key = ANY (ARRAY[
    'face_verification_required'::text, 'face_verification_threshold'::text,
    'gps_tracking_enabled'::text, 'photo_capture_enabled'::text,
    'leave_management_enabled'::text, 'overtime_tracking_enabled'::text,
    'show_marketing_landing_page'::text, 'twilio_sms_enabled'::text,
    'live_tracking_enabled'::text, 'testing_mode_enabled'::text,
    'oauth_phone_verification_enabled'::text, 'app_only_mode_enabled'::text,
    'auto_punchout_location_off'::text,
    'app_store_redirect_enabled'::text, 'app_store_links'::text
  ]))
);

-- Also whitelist these for public (unauthenticated) access via the RPC
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
      'app_only_mode_enabled'::text,
      'app_store_redirect_enabled'::text,
      'app_store_links'::text
    ]
  );
$$;
