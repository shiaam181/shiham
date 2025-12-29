-- Create company settings table
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL DEFAULT 'AttendanceHub',
  company_logo_url text,
  tagline text DEFAULT 'Employee Attendance Management System',
  default_shift_id uuid REFERENCES public.shifts(id),
  address text,
  contact_email text,
  contact_phone text,
  timezone text DEFAULT 'UTC',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage settings
CREATE POLICY "Admins can manage company settings" 
ON public.company_settings 
FOR ALL 
USING (is_admin());

-- All authenticated users can view settings
CREATE POLICY "All authenticated users can view company settings" 
ON public.company_settings 
FOR SELECT 
USING (true);

-- Insert default settings
INSERT INTO public.company_settings (company_name) VALUES ('AttendanceHub');

-- Add trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();