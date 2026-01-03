-- Fix week_offs RLS policies
DROP POLICY IF EXISTS "Admins can manage week offs" ON public.week_offs;
CREATE POLICY "Admins can manage week offs"
ON public.week_offs
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Fix holidays RLS policies
DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;
CREATE POLICY "Admins can manage holidays"
ON public.holidays
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Fix shifts RLS policies
DROP POLICY IF EXISTS "Admins can manage shifts" ON public.shifts;
CREATE POLICY "Admins can manage shifts"
ON public.shifts
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Fix leave_requests - admins need INSERT capability too
CREATE POLICY "Admins can insert leave requests"
ON public.leave_requests
FOR INSERT
TO authenticated
WITH CHECK (is_admin());