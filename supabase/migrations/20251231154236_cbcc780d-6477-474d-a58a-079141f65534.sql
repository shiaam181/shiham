-- Remove overly-permissive policy added earlier (PII exposure)
DROP POLICY IF EXISTS "Anyone can check phone existence" ON public.profiles;

-- Ensure OTP table is not readable/writable from the client (explicit deny policy)
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access" ON public.phone_otps;
CREATE POLICY "No client access"
ON public.phone_otps
FOR ALL
USING (false)
WITH CHECK (false);