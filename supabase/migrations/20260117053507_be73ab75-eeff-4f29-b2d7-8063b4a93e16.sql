-- Add registration_status column to profiles table to distinguish between pending and declined
-- Values: 'pending', 'approved', 'declined'
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'approved';

-- Update existing inactive profiles to be 'pending'
UPDATE public.profiles SET registration_status = 'pending' WHERE is_active = false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_profiles_registration_status ON public.profiles(registration_status);
CREATE INDEX IF NOT EXISTS idx_profiles_company_registration ON public.profiles(company_id, registration_status);