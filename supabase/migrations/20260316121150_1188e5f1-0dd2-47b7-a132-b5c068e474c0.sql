
-- Add new feature columns to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS employee_daily_updates_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_daily_updates_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_punchout_location_off boolean NOT NULL DEFAULT false;

-- Create daily_work_updates table
CREATE TABLE public.daily_work_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  photo_url text,
  description text NOT NULL,
  update_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create weekly_toppers table
CREATE TABLE public.weekly_toppers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  selected_by uuid NOT NULL,
  period_type text NOT NULL DEFAULT 'weekly',
  period_start date NOT NULL,
  period_end date NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_work_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_toppers ENABLE ROW LEVEL SECURITY;

-- RLS for daily_work_updates
-- Employees can manage their own updates
CREATE POLICY "Users can manage own daily updates"
  ON public.daily_work_updates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Managers can view their team's updates
CREATE POLICY "Managers can view team daily updates"
  ON public.daily_work_updates FOR SELECT
  USING (
    is_manager() AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = daily_work_updates.user_id
        AND p.manager_id = auth.uid()
    )
  );

-- HR/Admin/Owner can view company updates
CREATE POLICY "HR Admin Owner can view company daily updates"
  ON public.daily_work_updates FOR SELECT
  USING (
    (is_hr() OR is_admin() OR is_owner())
    AND company_id = get_user_company_id(auth.uid())
  );

-- Developers can manage all
CREATE POLICY "Developers can manage all daily updates"
  ON public.daily_work_updates FOR ALL
  USING (is_developer())
  WITH CHECK (is_developer());

-- RLS for weekly_toppers
CREATE POLICY "Users can view toppers in their company"
  ON public.weekly_toppers FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Managers can manage toppers"
  ON public.weekly_toppers FOR ALL
  USING (
    (is_manager() OR is_hr() OR is_admin() OR is_owner())
    AND company_id = get_user_company_id(auth.uid())
  )
  WITH CHECK (
    (is_manager() OR is_hr() OR is_admin() OR is_owner())
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Developers can manage all toppers"
  ON public.weekly_toppers FOR ALL
  USING (is_developer())
  WITH CHECK (is_developer());

-- Create storage bucket for daily update photos
INSERT INTO storage.buckets (id, name, public) VALUES ('daily-updates', 'daily-updates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for daily-updates bucket
CREATE POLICY "Users can upload own daily update photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'daily-updates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own daily update photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'daily-updates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Managers can view team daily update photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'daily-updates'
    AND is_manager()
  );

CREATE POLICY "HR Admin Owner can view company daily update photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'daily-updates'
    AND (is_hr() OR is_admin() OR is_owner() OR is_developer())
  );

-- Trigger for updated_at
CREATE TRIGGER update_daily_work_updates_updated_at
  BEFORE UPDATE ON public.daily_work_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
