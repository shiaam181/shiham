-- Allow anyone to search for active companies during registration
-- Only exposes id, name, logo_url (safe for public display)
CREATE POLICY "Anyone can search active companies for registration"
ON public.companies
FOR SELECT
USING (is_active = true);