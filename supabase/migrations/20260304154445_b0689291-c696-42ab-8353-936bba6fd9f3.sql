
-- Add geofencing_enabled column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS geofencing_enabled boolean DEFAULT false;

-- Create company_geofence_locations table
CREATE TABLE public.company_geofence_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    location_name text NOT NULL,
    address text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    radius_meters integer NOT NULL DEFAULT 100,
    is_active boolean NOT NULL DEFAULT true,
    aws_geofence_id text,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add geofence fields to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS geofence_location_id uuid REFERENCES public.company_geofence_locations(id);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS geofence_status text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS geofence_evaluation_result jsonb;

-- Create geofence_audit_logs for failed attempts
CREATE TABLE public.geofence_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy double precision,
    geofence_status text NOT NULL,
    nearest_location_name text,
    distance_meters double precision,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.company_geofence_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_geofence_locations
CREATE POLICY "Developers can manage all geofence locations"
ON public.company_geofence_locations FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Company admins can manage their geofence locations"
ON public.company_geofence_locations FOR ALL
TO authenticated
USING ((company_id = get_user_company_id(auth.uid())) AND (is_admin() OR is_owner() OR is_hr()))
WITH CHECK ((company_id = get_user_company_id(auth.uid())) AND (is_admin() OR is_owner() OR is_hr()));

CREATE POLICY "Employees can view their company geofence locations"
ON public.company_geofence_locations FOR SELECT
TO authenticated
USING (company_id = get_user_company_id(auth.uid()));

-- RLS policies for geofence_audit_logs
CREATE POLICY "Developers can view all geofence audit logs"
ON public.geofence_audit_logs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Company admins can view their geofence audit logs"
ON public.geofence_audit_logs FOR SELECT
TO authenticated
USING ((company_id = get_user_company_id(auth.uid())) AND (is_admin() OR is_owner() OR is_hr()));

CREATE POLICY "Users can insert their own geofence audit logs"
ON public.geofence_audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- AWS geofencing config stored in system_settings (key: 'aws_geofencing_config')
-- RLS already covers system_settings for developers

-- Add updated_at trigger
CREATE TRIGGER update_company_geofence_locations_updated_at
    BEFORE UPDATE ON public.company_geofence_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
