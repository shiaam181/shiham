
-- Drop existing policies for authenticated users reading system_settings
DROP POLICY IF EXISTS "Authenticated users can read non-secret system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can view non-secret settings" ON public.system_settings;

-- Create a new policy that includes live_tracking_enabled
CREATE POLICY "Authenticated users can read non-secret system settings" ON public.system_settings
  FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text) AND 
    (key = ANY (ARRAY[
      'face_verification_required'::text, 
      'face_verification_threshold'::text, 
      'gps_tracking_enabled'::text, 
      'photo_capture_enabled'::text, 
      'leave_management_enabled'::text, 
      'overtime_tracking_enabled'::text, 
      'show_marketing_landing_page'::text,
      'twilio_sms_enabled'::text,
      'live_tracking_enabled'::text
    ]))
  );
