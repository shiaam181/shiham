
-- Tenant email settings per company
CREATE TABLE public.tenant_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_name text,
  from_email text,
  reply_to_email text,
  email_enabled boolean NOT NULL DEFAULT true,
  use_global_credentials boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.tenant_email_settings ENABLE ROW LEVEL SECURITY;

-- Owners/admins can manage their company email settings
CREATE POLICY "Company admins can manage email settings"
  ON public.tenant_email_settings FOR ALL
  TO authenticated
  USING (
    (is_developer()) OR
    (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_owner() OR is_hr()))
  )
  WITH CHECK (
    (is_developer()) OR
    (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_owner() OR is_hr()))
  );

-- Employees can view their company email settings (to check if email is enabled)
CREATE POLICY "Employees can view own company email settings"
  ON public.tenant_email_settings FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- Email tokens table for invite and password reset (hashed tokens)
CREATE TABLE public.email_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  request_ip text
);

ALTER TABLE public.email_tokens ENABLE ROW LEVEL SECURITY;

-- Only edge functions (service role) should access tokens - no client access
CREATE POLICY "No client access to email tokens"
  ON public.email_tokens FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Developers can view tokens for debugging
CREATE POLICY "Developers can view email tokens"
  ON public.email_tokens FOR SELECT
  TO authenticated
  USING (is_developer());

-- Add brevo_smtp_config to the allowed public readable settings
-- (No need - it will be read by edge functions via service role)

-- Add index for token lookups
CREATE INDEX idx_email_tokens_hash ON public.email_tokens(token_hash);
CREATE INDEX idx_email_tokens_user_purpose ON public.email_tokens(user_id, purpose);
