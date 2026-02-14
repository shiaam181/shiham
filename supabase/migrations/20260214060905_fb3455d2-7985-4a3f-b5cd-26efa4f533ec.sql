
-- Drop and recreate the authenticated user read policy to include testing/oauth/app-only mode settings
DROP POLICY IF EXISTS "Authenticated users can read non-secret system settings" ON public.system_settings;

CREATE POLICY "Authenticated users can read non-secret system settings"
ON public.system_settings
FOR SELECT
USING (
  (auth.role() = 'authenticated' AND key = ANY (ARRAY[
    'face_verification_required',
    'face_verification_threshold',
    'gps_tracking_enabled',
    'photo_capture_enabled',
    'leave_management_enabled',
    'overtime_tracking_enabled',
    'show_marketing_landing_page',
    'twilio_sms_enabled',
    'live_tracking_enabled',
    'testing_mode_enabled',
    'oauth_phone_verification_enabled',
    'app_only_mode_enabled'
  ]))
);

-- Also add testing_mode_enabled to public read policy so unauthenticated Auth page can check it
DROP POLICY IF EXISTS "Public can read auth settings" ON public.system_settings;

CREATE POLICY "Public can read auth settings"
ON public.system_settings
FOR SELECT
USING (
  key = ANY (ARRAY[
    'google_signin_enabled',
    'phone_otp_enabled',
    'email_otp_enabled',
    'password_login_enabled',
    'show_marketing_landing_page',
    'testing_mode_enabled',
    'oauth_phone_verification_enabled',
    'app_only_mode_enabled'
  ])
);
