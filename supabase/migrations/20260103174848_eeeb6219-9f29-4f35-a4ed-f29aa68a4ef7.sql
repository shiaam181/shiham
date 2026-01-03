-- 1. Create audit_logs table for role modifications and admin actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and developers can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (is_admin() OR is_developer());

-- System can insert audit logs (via service role from edge functions)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- 2. Create trigger to audit role changes
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
    VALUES (COALESCE(auth.uid(), NEW.user_id), 'INSERT', 'user_roles', NEW.id::text, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_value, new_value)
    VALUES (COALESCE(auth.uid(), NEW.user_id), 'UPDATE', 'user_roles', NEW.id::text, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_value)
    VALUES (COALESCE(auth.uid(), OLD.user_id), 'DELETE', 'user_roles', OLD.id::text, row_to_json(OLD)::jsonb);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_user_roles_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();

-- 3. Fix race condition in handle_new_user by using advisory lock
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  
  -- Use advisory lock to prevent race condition on first user check
  PERFORM pg_advisory_xact_lock(12345);
  
  -- First user becomes admin, rest are employees
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) INTO is_first_user;
  
  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Update system_settings RLS to remove twilio_sms_enabled from public whitelist
DROP POLICY IF EXISTS "Authenticated users can view non-secret settings" ON public.system_settings;

CREATE POLICY "Authenticated users can view non-secret settings"
ON public.system_settings
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  key IN (
    'face_verification_required',
    'face_verification_threshold',
    'gps_tracking_enabled',
    'photo_capture_enabled',
    'leave_management_enabled',
    'overtime_tracking_enabled',
    'show_marketing_landing_page'
  )
);