CREATE POLICY "Developers can manage app base url"
  ON public.system_settings
  FOR ALL
  USING (is_developer() AND key = 'app_base_url')
  WITH CHECK (is_developer() AND key = 'app_base_url');