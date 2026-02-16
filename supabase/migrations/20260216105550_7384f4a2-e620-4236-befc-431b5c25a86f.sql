
-- Drop the recursive policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and developers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Developers can view all profiles" ON public.profiles;

-- Recreate admin SELECT policy using security definer function (no self-reference)
CREATE POLICY "Admins can view company profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = get_user_company_id(auth.uid())
);

-- Recreate admin UPDATE policy using security definer function (no self-reference)
CREATE POLICY "Admins can update company profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = get_user_company_id(auth.uid())
);

-- Recreate developer SELECT policy using security definer function
CREATE POLICY "Developers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'developer'::app_role));
