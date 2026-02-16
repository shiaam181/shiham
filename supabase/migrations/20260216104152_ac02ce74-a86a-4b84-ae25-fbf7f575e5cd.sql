
-- Fix: Restrict public access to companies table
-- Replace the broad public SELECT policy with a view that only exposes safe fields

-- Drop the overly permissive public policies
DROP POLICY IF EXISTS "Public can search active companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can search active companies for registration" ON public.companies;

-- Create a secure public view with only non-sensitive fields (no invite_code, no slugs, no usage metrics)
CREATE OR REPLACE VIEW public.companies_public AS
SELECT id, name, logo_url, brand_color, tagline
FROM public.companies
WHERE is_active = true;

-- Grant public access to the view only
GRANT SELECT ON public.companies_public TO anon;
GRANT SELECT ON public.companies_public TO authenticated;
