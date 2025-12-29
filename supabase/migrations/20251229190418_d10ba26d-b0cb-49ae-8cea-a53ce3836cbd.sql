-- Insert face verification threshold setting
INSERT INTO public.system_settings (key, value)
VALUES ('face_verification_threshold', '{"threshold": 70}'::jsonb)
ON CONFLICT (key) DO NOTHING;