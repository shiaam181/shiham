-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Add company_id to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Create app_updates table for tracking version updates
CREATE TABLE public.app_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_critical BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on app_updates
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

-- Create user_seen_updates table for tracking which users have seen updates
CREATE TABLE public.user_seen_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_id UUID NOT NULL REFERENCES public.app_updates(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, update_id)
);

-- Enable RLS on user_seen_updates
ALTER TABLE public.user_seen_updates ENABLE ROW LEVEL SECURITY;

-- Add system setting for app-only mode
INSERT INTO public.system_settings (key, value) 
VALUES ('app_only_mode', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS Policies for companies
-- Developers can see all companies
CREATE POLICY "Developers can view all companies"
ON public.companies FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

-- Owners can view their own company
CREATE POLICY "Owners can view their company"
ON public.companies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = companies.id
    AND public.has_role(auth.uid(), 'owner')
  )
);

-- Admins can view their company
CREATE POLICY "Admins can view their company"
ON public.companies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = companies.id
    AND public.has_role(auth.uid(), 'admin')
  )
);

-- Employees can view their company
CREATE POLICY "Employees can view their company"
ON public.companies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = companies.id
  )
);

-- Developers can manage all companies
CREATE POLICY "Developers can insert companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can update companies"
ON public.companies FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

-- Owners can update their company details
CREATE POLICY "Owners can update their company"
ON public.companies FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = companies.id
    AND public.has_role(auth.uid(), 'owner')
  )
);

-- RLS Policies for app_updates
CREATE POLICY "Everyone can view app updates"
ON public.app_updates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Developers can insert app updates"
ON public.app_updates FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can update app updates"
ON public.app_updates FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can delete app updates"
ON public.app_updates FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

-- RLS Policies for user_seen_updates
CREATE POLICY "Users can view their own seen updates"
ON public.user_seen_updates FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can mark updates as seen"
ON public.user_seen_updates FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner'
  )
$$;

-- Create index for better performance on company lookups
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_invite_code ON public.companies(invite_code);

-- Trigger to update updated_at for companies (if the function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;