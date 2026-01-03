-- Make the employee-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'employee-photos';

-- Create RLS policies for the employee-photos bucket
-- Users can view their own photos
DROP POLICY IF EXISTS "Users can view their own photos" ON storage.objects;
CREATE POLICY "Users can view their own photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'employee-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins and developers can view all photos
DROP POLICY IF EXISTS "Admins and developers can view all photos" ON storage.objects;
CREATE POLICY "Admins and developers can view all photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'employee-photos' AND (public.is_admin() OR public.is_developer()));

-- Users can upload their own photos
DROP POLICY IF EXISTS "Users can upload their own photos" ON storage.objects;
CREATE POLICY "Users can upload their own photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'employee-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own photos
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
CREATE POLICY "Users can update their own photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'employee-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own photos
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
CREATE POLICY "Users can delete their own photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'employee-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create a rate limiting table for OTP requests
CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  ip_address text,
  request_count integer DEFAULT 1,
  first_request_at timestamp with time zone DEFAULT now(),
  last_request_at timestamp with time zone DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_phone ON public.otp_rate_limits(phone);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_ip ON public.otp_rate_limits(ip_address);

-- Enable RLS with no client access (service role only)
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to rate limits" ON public.otp_rate_limits;
CREATE POLICY "No client access to rate limits" 
ON public.otp_rate_limits 
FOR ALL 
USING (false) 
WITH CHECK (false);