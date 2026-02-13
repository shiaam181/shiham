-- Allow developers to update all profiles
CREATE POLICY "Developers can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));