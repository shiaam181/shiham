-- Create phone_otps table for storing OTP codes
CREATE TABLE public.phone_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_phone_otps_phone ON public.phone_otps (phone);
CREATE INDEX idx_phone_otps_expires_at ON public.phone_otps (expires_at);

-- Enable RLS
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- No public access policies needed - this table is accessed only via edge functions with service role key