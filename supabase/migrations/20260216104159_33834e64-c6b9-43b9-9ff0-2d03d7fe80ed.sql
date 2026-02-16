
-- Fix: Change view to SECURITY INVOKER to avoid security definer warning
ALTER VIEW public.companies_public SET (security_invoker = on);
