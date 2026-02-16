
-- Fix: Admin Cross-Company Data Access
-- Replace admin policies that allow cross-company access with company-scoped versions

-- ========== LEAVE_REQUESTS ==========
DROP POLICY IF EXISTS "Admins can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can update all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can insert leave requests" ON public.leave_requests;

CREATE POLICY "Admins can view company leave requests"
ON public.leave_requests FOR SELECT
USING (
  is_admin() AND EXISTS (
    SELECT 1 FROM profiles admin_profile
    JOIN profiles emp_profile ON emp_profile.user_id = leave_requests.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = emp_profile.company_id
  )
);

CREATE POLICY "Admins can update company leave requests"
ON public.leave_requests FOR UPDATE
USING (
  is_admin() AND EXISTS (
    SELECT 1 FROM profiles admin_profile
    JOIN profiles emp_profile ON emp_profile.user_id = leave_requests.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = emp_profile.company_id
  )
)
WITH CHECK (
  is_admin() AND EXISTS (
    SELECT 1 FROM profiles admin_profile
    JOIN profiles emp_profile ON emp_profile.user_id = leave_requests.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = emp_profile.company_id
  )
);

CREATE POLICY "Admins can insert company leave requests"
ON public.leave_requests FOR INSERT
WITH CHECK (
  is_admin() AND EXISTS (
    SELECT 1 FROM profiles admin_profile
    JOIN profiles emp_profile ON emp_profile.user_id = leave_requests.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = emp_profile.company_id
  )
);

-- ========== ATTENDANCE ==========
DROP POLICY IF EXISTS "Admins and developers can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can update all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance;

-- Developers keep cross-company access (for support)
CREATE POLICY "Developers can view all attendance"
ON public.attendance FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'developer'
  )
);

CREATE POLICY "Admins can view company attendance"
ON public.attendance FOR SELECT
USING (
  is_admin() AND EXISTS (
    SELECT 1 FROM profiles admin_profile
    JOIN profiles emp_profile ON emp_profile.user_id = attendance.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = emp_profile.company_id
  )
);

CREATE POLICY "Admins can update company attendance"
ON public.attendance FOR UPDATE
USING (
  is_admin() AND EXISTS (
    SELECT 1 FROM profiles admin_profile
    JOIN profiles emp_profile ON emp_profile.user_id = attendance.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = emp_profile.company_id
  )
);

CREATE POLICY "Admins can delete company attendance"
ON public.attendance FOR DELETE
USING (
  is_admin() AND EXISTS (
    SELECT 1 FROM profiles admin_profile
    JOIN profiles emp_profile ON emp_profile.user_id = attendance.user_id
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = emp_profile.company_id
  )
);

-- ========== PROFILES ==========
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can view company profiles"
ON public.profiles FOR SELECT
USING (
  is_admin() AND EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = profiles.company_id
  )
);

CREATE POLICY "Admins can update company profiles"
ON public.profiles FOR UPDATE
USING (
  is_admin() AND EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.company_id = profiles.company_id
  )
);
