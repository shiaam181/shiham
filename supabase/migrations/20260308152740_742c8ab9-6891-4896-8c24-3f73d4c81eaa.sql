
CREATE TABLE public.mood_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  mood text NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'bad', 'terrible')),
  note text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own mood" ON public.mood_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own mood" ON public.mood_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own mood" ON public.mood_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view company moods" ON public.mood_entries FOR SELECT TO authenticated USING (
  (is_admin() OR is_hr() OR is_developer()) AND company_id = get_user_company_id(auth.uid())
);
CREATE POLICY "Developers can view all moods" ON public.mood_entries FOR SELECT TO authenticated USING (is_developer());
