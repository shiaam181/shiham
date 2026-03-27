
CREATE TABLE public.plan_feature_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.pricing_plans(id) ON DELETE CASCADE,
  feature_name text NOT NULL,
  status text NOT NULL DEFAULT 'yes',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_name)
);

ALTER TABLE public.plan_feature_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plan features" ON public.plan_feature_config
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage plan features" ON public.plan_feature_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.platform_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'Core',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform features" ON public.platform_features
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage platform features" ON public.platform_features
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.platform_features (name, category, sort_order) VALUES
  ('Leave Management', 'Core HR', 1),
  ('Attendance Management', 'Core HR', 2),
  ('Employee Self Onboarding', 'Core HR', 3),
  ('Employee Portal (Web & Mobile)', 'Core HR', 4),
  ('Employee Workflows & Automation', 'Automation', 5),
  ('Payroll Management', 'Payroll', 6),
  ('Statutory Compliance', 'Payroll', 7),
  ('Performance Management', 'Performance', 8),
  ('KPI Tracking', 'Performance', 9),
  ('Face Verification', 'Security', 10),
  ('Geofencing & GPS', 'Security', 11),
  ('Live Location Tracking', 'Security', 12),
  ('Document Management', 'Operations', 13),
  ('Reports & Analytics', 'Operations', 14),
  ('Employee Engagement', 'Operations', 15),
  ('Daily Work Updates', 'Operations', 16),
  ('Shift Management', 'Operations', 17),
  ('Holiday & Week-off Management', 'Operations', 18),
  ('Smart Notifications', 'Automation', 19),
  ('HR Assistant (AI)', 'AI', 20),
  ('API Access', 'Advanced', 21),
  ('Priority Support', 'Advanced', 22),
  ('Custom Branding', 'Advanced', 23),
  ('Audit Trail', 'Advanced', 24);
