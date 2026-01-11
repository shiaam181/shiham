-- Drop the permissive insert policy
DROP POLICY IF EXISTS "Service role can insert invite history" ON public.invite_usage_history;

-- Insert will only happen via edge functions using service role key, no client-side policy needed
-- The table is protected by RLS and only service role (bypasses RLS) can insert