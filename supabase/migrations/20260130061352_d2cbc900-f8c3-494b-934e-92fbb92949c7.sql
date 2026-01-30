-- Allow company owners to update attendance for employees in their company
CREATE POLICY "Owners can update their company employees attendance"
ON public.attendance
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles owner_profile
    WHERE owner_profile.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'owner'
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles emp_profile
      WHERE emp_profile.user_id = attendance.user_id
      AND emp_profile.company_id = owner_profile.company_id
    )
  )
);

-- Allow company owners to view attendance for employees in their company
CREATE POLICY "Owners can view their company employees attendance"
ON public.attendance
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles owner_profile
    WHERE owner_profile.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'owner'
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles emp_profile
      WHERE emp_profile.user_id = attendance.user_id
      AND emp_profile.company_id = owner_profile.company_id
    )
  )
);