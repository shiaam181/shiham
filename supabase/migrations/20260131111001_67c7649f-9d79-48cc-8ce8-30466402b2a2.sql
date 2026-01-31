-- Fix week_offs RLS to allow developers and owners to manage week offs
DROP POLICY IF EXISTS "Admins can manage week offs" ON public.week_offs;

CREATE POLICY "Admins developers and owners can manage week offs"
ON public.week_offs
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'developer'::public.app_role)
  OR has_role(auth.uid(), 'owner'::public.app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'developer'::public.app_role)
  OR has_role(auth.uid(), 'owner'::public.app_role)
);