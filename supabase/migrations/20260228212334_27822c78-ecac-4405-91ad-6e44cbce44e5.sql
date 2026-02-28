
-- Add brevo_smtp_config to the developer-manageable settings
-- Drop and recreate the policy to include brevo_smtp_config in the credential exclusion handling
-- The existing policy blocks twilio/resend/emailjs configs from admins but allows everything else for devs/admins
-- We need to ensure brevo_smtp_config is explicitly allowed for developers only

-- Create a permissive policy for developers to manage brevo credentials
CREATE POLICY "Developers can manage brevo config"
  ON public.system_settings
  FOR ALL
  USING (is_developer() AND key = 'brevo_smtp_config')
  WITH CHECK (is_developer() AND key = 'brevo_smtp_config');
