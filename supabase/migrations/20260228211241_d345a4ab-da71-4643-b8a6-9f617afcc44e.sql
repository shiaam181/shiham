
-- Allow developers to read/write brevo_smtp_config
-- Already covered by existing "Admins and developers can manage non-credential settings" policy
-- But brevo_smtp_config is not in the blocked list, so it's already accessible. No changes needed.

-- Just ensure the brevo key is accessible to edge functions (service role bypasses RLS)
-- No migration needed - confirming existing policies are sufficient.
SELECT 1;
