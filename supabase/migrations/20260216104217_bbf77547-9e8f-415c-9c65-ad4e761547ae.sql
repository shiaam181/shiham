
-- Add a restricted public SELECT policy that only allows reading safe columns
-- The RLS policy controls row access; column restriction is handled by the view
-- We need a minimal policy so authenticated users can still search companies during registration
CREATE POLICY "Public can view active company names"
ON public.companies FOR SELECT
USING (is_active = true);
