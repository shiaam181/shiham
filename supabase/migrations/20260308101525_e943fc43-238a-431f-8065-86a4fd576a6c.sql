-- Allow managers to view their team's leave requests
CREATE POLICY "Managers can view team leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  is_manager() AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = leave_requests.user_id
      AND p.manager_id = auth.uid()
  )
);

-- Allow managers to update (approve/reject) their team's leave requests
CREATE POLICY "Managers can update team leave requests"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  is_manager() AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = leave_requests.user_id
      AND p.manager_id = auth.uid()
  )
)
WITH CHECK (
  is_manager() AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = leave_requests.user_id
      AND p.manager_id = auth.uid()
  )
);

-- Allow HR to view all manager profiles for team assignment
-- (HR already has access via is_admin check but let's ensure they can see profiles for assignment)
