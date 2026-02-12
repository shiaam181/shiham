-- Add UPDATE policy for owners on user_roles (company-scoped)
CREATE POLICY "Owners can update roles in their company"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  is_owner() AND EXISTS (
    SELECT 1
    FROM profiles owner_profile
    JOIN profiles target_profile ON target_profile.user_id = user_roles.user_id
    WHERE owner_profile.user_id = auth.uid()
      AND owner_profile.company_id = target_profile.company_id
  )
);

-- Add INSERT policy for owners on user_roles (company-scoped)
CREATE POLICY "Owners can insert roles in their company"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  is_owner() AND EXISTS (
    SELECT 1
    FROM profiles owner_profile
    JOIN profiles target_profile ON target_profile.user_id = user_roles.user_id
    WHERE owner_profile.user_id = auth.uid()
      AND owner_profile.company_id = target_profile.company_id
  )
);