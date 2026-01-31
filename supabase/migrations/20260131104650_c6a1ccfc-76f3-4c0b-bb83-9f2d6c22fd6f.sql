-- Allow public read access to companies for registration search
CREATE POLICY "Public can search active companies"
ON public.companies
FOR SELECT
USING (is_active = true);