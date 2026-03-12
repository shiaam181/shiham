
-- Review Cycles (annual, quarterly, etc.)
CREATE TABLE public.review_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  cycle_type TEXT NOT NULL DEFAULT 'annual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Goals
CREATE TABLE public.performance_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  review_cycle_id UUID REFERENCES public.review_cycles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'individual',
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT,
  weight NUMERIC DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'not_started',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KPI Definitions (templates)
CREATE TABLE public.kpi_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  measurement_type TEXT NOT NULL DEFAULT 'numeric',
  target_value NUMERIC,
  unit TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KPI Scores per employee per period
CREATE TABLE public.kpi_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id UUID REFERENCES public.kpi_definitions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  review_cycle_id UUID REFERENCES public.review_cycles(id) ON DELETE SET NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC,
  notes TEXT,
  scored_by UUID,
  scored_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Reviews
CREATE TABLE public.performance_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  review_cycle_id UUID REFERENCES public.review_cycles(id) ON DELETE SET NULL,
  overall_rating NUMERIC,
  strengths TEXT,
  improvements TEXT,
  manager_comments TEXT,
  employee_comments TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_performance_goals_user ON public.performance_goals(user_id);
CREATE INDEX idx_performance_goals_company ON public.performance_goals(company_id);
CREATE INDEX idx_kpi_scores_user ON public.kpi_scores(user_id);
CREATE INDEX idx_kpi_scores_company ON public.kpi_scores(company_id);
CREATE INDEX idx_performance_reviews_user ON public.performance_reviews(user_id);
CREATE INDEX idx_performance_reviews_company ON public.performance_reviews(company_id);
CREATE INDEX idx_review_cycles_company ON public.review_cycles(company_id);

-- Enable RLS
ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

-- RLS: review_cycles
CREATE POLICY "Company members can view review cycles" ON public.review_cycles
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage review cycles" ON public.review_cycles
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()));

-- RLS: performance_goals
CREATE POLICY "Users can view own goals" ON public.performance_goals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view team goals" ON public.performance_goals
  FOR SELECT TO authenticated
  USING (is_manager() AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = performance_goals.user_id AND p.manager_id = auth.uid()
  ));

CREATE POLICY "Admins can manage company goals" ON public.performance_goals
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()));

CREATE POLICY "Users can manage own goals" ON public.performance_goals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS: kpi_definitions
CREATE POLICY "Company members can view KPIs" ON public.kpi_definitions
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage KPIs" ON public.kpi_definitions
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()));

-- RLS: kpi_scores
CREATE POLICY "Users can view own KPI scores" ON public.kpi_scores
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view team KPI scores" ON public.kpi_scores
  FOR SELECT TO authenticated
  USING (is_manager() AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = kpi_scores.user_id AND p.manager_id = auth.uid()
  ));

CREATE POLICY "Admins can manage KPI scores" ON public.kpi_scores
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()));

-- RLS: performance_reviews
CREATE POLICY "Users can view own reviews" ON public.performance_reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Reviewers can manage their reviews" ON public.performance_reviews
  FOR ALL TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Admins can manage company reviews" ON public.performance_reviews
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_hr() OR is_developer()));
