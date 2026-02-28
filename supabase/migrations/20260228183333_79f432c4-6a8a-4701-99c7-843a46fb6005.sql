
-- Drop old announcements table and recreate with full schema
DROP TABLE IF EXISTS public.announcements CASCADE;

-- Announcements table with scope, targeting, attachments
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'TENANT' CHECK (scope IN ('TENANT', 'GLOBAL')),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'IMPORTANT', 'URGENT')),
  category text NOT NULL DEFAULT 'GENERAL' CHECK (category IN ('GENERAL', 'HR', 'PAYROLL', 'COMPLIANCE', 'SYSTEM')),
  target_audience text NOT NULL DEFAULT 'ALL' CHECK (target_audience IN ('ALL', 'ROLE_BASED', 'DEPARTMENT', 'LOCATION', 'CUSTOM')),
  target_roles text[] DEFAULT NULL,
  target_departments text[] DEFAULT NULL,
  target_locations text[] DEFAULT NULL,
  target_user_ids uuid[] DEFAULT NULL,
  publish_at timestamptz DEFAULT NULL,
  expires_at timestamptz DEFAULT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
  attachments_json jsonb DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_announcements_scope ON public.announcements(scope);
CREATE INDEX idx_announcements_company_id ON public.announcements(company_id);
CREATE INDEX idx_announcements_status ON public.announcements(status);
CREATE INDEX idx_announcements_created_at ON public.announcements(created_at DESC);

-- RLS: Developers can manage all
CREATE POLICY "Developers can manage all announcements"
  ON public.announcements FOR ALL
  USING (is_developer());

-- RLS: Owner/HR/Admin can manage tenant announcements
CREATE POLICY "Admin/Owner/HR can manage tenant announcements"
  ON public.announcements FOR ALL
  USING (
    scope = 'TENANT' 
    AND company_id = get_user_company_id(auth.uid()) 
    AND (is_admin() OR is_owner() OR is_hr())
  )
  WITH CHECK (
    scope = 'TENANT' 
    AND company_id = get_user_company_id(auth.uid()) 
    AND (is_admin() OR is_owner() OR is_hr())
  );

-- RLS: Employees can view published tenant announcements for their company
CREATE POLICY "Employees can view published tenant announcements"
  ON public.announcements FOR SELECT
  USING (
    scope = 'TENANT' 
    AND status = 'PUBLISHED' 
    AND company_id = get_user_company_id(auth.uid())
    AND (expires_at IS NULL OR expires_at > now())
  );

-- RLS: All authenticated users can view published global announcements
CREATE POLICY "All users can view published global announcements"
  ON public.announcements FOR SELECT
  USING (
    scope = 'GLOBAL' 
    AND status = 'PUBLISHED'
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Announcement reads table
CREATE TABLE public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_announcement_reads_user ON public.announcement_reads(user_id);
CREATE INDEX idx_announcement_reads_announcement ON public.announcement_reads(announcement_id);

CREATE POLICY "Users can manage own reads"
  ON public.announcement_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view company reads"
  ON public.announcement_reads FOR SELECT
  USING (is_admin() OR is_hr() OR is_owner() OR is_developer());

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'ANNOUNCEMENT' CHECK (type IN ('ANNOUNCEMENT', 'PAYROLL', 'LEAVE', 'ATTENDANCE', 'SYSTEM')),
  title text NOT NULL,
  message text DEFAULT '',
  link_url text DEFAULT NULL,
  reference_id uuid DEFAULT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- System can insert notifications (via admin/developer)
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (is_admin() OR is_hr() OR is_owner() OR is_developer());

CREATE POLICY "Developers can manage all notifications"
  ON public.notifications FOR ALL
  USING (is_developer());
