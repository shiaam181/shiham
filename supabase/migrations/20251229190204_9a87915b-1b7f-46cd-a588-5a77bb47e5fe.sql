-- Insert emailjs_config setting if it doesn't exist
INSERT INTO public.system_settings (key, value)
VALUES ('emailjs_config', '{"service_id": "", "template_id": "", "public_key": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;