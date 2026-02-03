-- Add live_tracking_enabled column to companies table (company-level toggle)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS live_tracking_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tracking_interval_seconds integer DEFAULT 60;

-- Add global live tracking setting to system_settings
INSERT INTO public.system_settings (key, value) 
VALUES ('live_tracking_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create employee consent table
CREATE TABLE IF NOT EXISTS public.employee_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_tracking_consented boolean DEFAULT false,
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create employee live location table
CREATE TABLE IF NOT EXISTS public.employee_live_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  speed double precision,
  heading double precision,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_live_locations_company_id ON public.employee_live_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_live_locations_user_id ON public.employee_live_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_live_locations_recorded_at ON public.employee_live_locations(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_live_locations_company_recorded ON public.employee_live_locations(company_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.employee_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_live_locations ENABLE ROW LEVEL SECURITY;

-- RLS for employee_consent
-- Employees can view and update their own consent
CREATE POLICY "Users can view their own consent"
ON public.employee_consent FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent"
ON public.employee_consent FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consent"
ON public.employee_consent FOR UPDATE
USING (auth.uid() = user_id);

-- Admins/Owners can view consent status for their company employees
CREATE POLICY "Admins can view company consent"
ON public.employee_consent FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.user_id = auth.uid()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND EXISTS (
      SELECT 1 FROM profiles emp_profile
      WHERE emp_profile.user_id = employee_consent.user_id
      AND emp_profile.company_id = admin_profile.company_id
    )
  )
);

-- Developers can view all consent
CREATE POLICY "Developers can view all consent"
ON public.employee_consent FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

-- RLS for employee_live_locations
-- Employees can ONLY insert their own location (company_id derived server-side)
CREATE POLICY "Users can insert their own location"
ON public.employee_live_locations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Employees can view their own location history
CREATE POLICY "Users can view their own location"
ON public.employee_live_locations FOR SELECT
USING (auth.uid() = user_id);

-- Owners/Admins can view locations for their company only
CREATE POLICY "Owners can view company locations"
ON public.employee_live_locations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.company_id = employee_live_locations.company_id
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Developers can view all locations
CREATE POLICY "Developers can view all locations"
ON public.employee_live_locations FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

-- Create trigger for updated_at on employee_consent
CREATE TRIGGER update_employee_consent_updated_at
  BEFORE UPDATE ON public.employee_consent
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live locations (for live map updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_live_locations;