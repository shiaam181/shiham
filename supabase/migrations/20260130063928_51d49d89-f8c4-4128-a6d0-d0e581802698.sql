-- Add per-company face verification override
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS face_verification_disabled boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.companies.face_verification_disabled IS 'When true, bypasses face verification requirement for all employees of this company';