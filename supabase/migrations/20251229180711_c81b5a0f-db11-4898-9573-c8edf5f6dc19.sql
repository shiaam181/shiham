-- Add a system_settings table to store global settings like face verification requirement
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings
CREATE POLICY "Anyone can read system settings" 
ON public.system_settings 
FOR SELECT 
USING (true);

-- Only developers can update settings
CREATE POLICY "Developers can update system settings" 
ON public.system_settings 
FOR UPDATE 
USING (public.is_developer());

-- Only developers can insert settings
CREATE POLICY "Developers can insert system settings" 
ON public.system_settings 
FOR INSERT 
WITH CHECK (public.is_developer());

-- Insert default setting for face verification
INSERT INTO public.system_settings (key, value) 
VALUES ('face_verification_required', '{"enabled": true}'::jsonb);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();