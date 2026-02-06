-- Fix infinite recursion by using a security definer function instead of self-referencing query

-- First, drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Owners can view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owners can update company profiles" ON public.profiles;

-- Create a security definer function to get the user's company_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Create a function to check if user is owner of a specific company
CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'owner'::public.app_role
      AND p.company_id = _company_id
  )
$$;

-- Now create the policies using the security definer functions (no self-reference)
CREATE POLICY "Owners can view company profiles"
ON public.profiles
FOR SELECT
USING (
  public.is_company_owner(auth.uid(), company_id)
);

CREATE POLICY "Owners can update company profiles"
ON public.profiles
FOR UPDATE
USING (
  public.is_company_owner(auth.uid(), company_id)
)
WITH CHECK (
  public.is_company_owner(auth.uid(), company_id)
);