-- Fix infinite recursion in RLS policies for public.profiles
-- Cause: a profiles SELECT policy directly queries user_roles, whose RLS policies query profiles,
-- creating a circular dependency.

DROP POLICY IF EXISTS "Admins and developers can view all profiles" ON public.profiles;

CREATE POLICY "Admins and developers can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'developer'::public.app_role)
);
