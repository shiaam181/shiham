-- Tighten system_settings SELECT to avoid exposing secrets (e.g., twilio_config)
-- Keep feature toggles readable by all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins and developers can manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Developers can insert system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Developers can update system settings" ON public.system_settings;

CREATE POLICY "Authenticated users can read non-secret system settings"
ON public.system_settings
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND key IN (
    'face_verification_required',
    'face_verification_threshold',
    'gps_tracking_enabled',
    'photo_capture_enabled',
    'leave_management_enabled',
    'overtime_tracking_enabled',
    'show_marketing_landing_page',
    'twilio_sms_enabled'
  )
);

CREATE POLICY "Admins and developers can manage system settings"
ON public.system_settings
FOR ALL
USING (is_admin() OR is_developer())
WITH CHECK (is_admin() OR is_developer());

-- Leave requests: allow developers to manage like admins
DROP POLICY IF EXISTS "Admins can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can update all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can insert leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Developers can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Developers can update all leave requests" ON public.leave_requests;

CREATE POLICY "Admins can view all leave requests"
ON public.leave_requests
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update all leave requests"
ON public.leave_requests
FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can insert leave requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Developers can view all leave requests"
ON public.leave_requests
FOR SELECT
USING (is_developer());

CREATE POLICY "Developers can update all leave requests"
ON public.leave_requests
FOR UPDATE
USING (is_developer())
WITH CHECK (is_developer());