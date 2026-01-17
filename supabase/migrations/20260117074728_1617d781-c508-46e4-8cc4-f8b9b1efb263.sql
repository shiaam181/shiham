-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage challenges" ON public.attendance_challenges;

-- Note: Edge functions using service_role key bypass RLS entirely.
-- We only need the user select policy for reading own challenges.
-- The insert/update/delete will be done by edge functions with service_role.