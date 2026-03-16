-- Update RLS policy to allow reading the auto_punchout_location_off setting
DROP POLICY IF EXISTS "Authenticated users can read non-secret system settings" ON public.system_settings;

CREATE POLICY "Authenticated users can read non-secret system settings"
ON public.system_settings
FOR SELECT
TO public
USING (
  (auth.role() = 'authenticated'::text) AND (key = ANY (ARRAY[
    'face_verification_required'::text,
    'face_verification_threshold'::text,
    'gps_tracking_enabled'::text,
    'photo_capture_enabled'::text,
    'leave_management_enabled'::text,
    'overtime_tracking_enabled'::text,
    'show_marketing_landing_page'::text,
    'twilio_sms_enabled'::text,
    'live_tracking_enabled'::text,
    'testing_mode_enabled'::text,
    'oauth_phone_verification_enabled'::text,
    'app_only_mode_enabled'::text,
    'auto_punchout_location_off'::text
  ]))
);