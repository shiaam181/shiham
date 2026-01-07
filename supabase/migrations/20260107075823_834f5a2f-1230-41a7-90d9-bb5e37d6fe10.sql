-- Add invite link settings to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS invite_max_uses INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS invite_uses_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.companies.invite_max_uses IS 'Maximum number of uses for invite link. NULL means unlimited.';
COMMENT ON COLUMN public.companies.invite_uses_count IS 'Current number of times the invite link has been used.';
COMMENT ON COLUMN public.companies.invite_expires_at IS 'Expiry date for the invite link. NULL means no expiry.';