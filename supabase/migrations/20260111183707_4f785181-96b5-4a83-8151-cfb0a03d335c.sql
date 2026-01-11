-- Create invite usage history table
CREATE TABLE public.invite_usage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invite_usage_history ENABLE ROW LEVEL SECURITY;

-- Create index for fast lookups
CREATE INDEX idx_invite_usage_history_company_id ON public.invite_usage_history(company_id);
CREATE INDEX idx_invite_usage_history_invite_code ON public.invite_usage_history(invite_code);
CREATE INDEX idx_invite_usage_history_joined_at ON public.invite_usage_history(joined_at DESC);

-- RLS Policies
-- Admins, owners, and developers can view invite history for their company
CREATE POLICY "Admins can view company invite history"
ON public.invite_usage_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.company_id = invite_usage_history.company_id
    AND (is_admin() OR is_owner() OR is_developer())
  )
);

-- Developers can view all invite history
CREATE POLICY "Developers can view all invite history"
ON public.invite_usage_history
FOR SELECT
USING (is_developer());

-- Only system (via edge function) can insert - use service role
CREATE POLICY "Service role can insert invite history"
ON public.invite_usage_history
FOR INSERT
WITH CHECK (true);

-- Add company branding columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#0284c7',
ADD COLUMN IF NOT EXISTS tagline TEXT;