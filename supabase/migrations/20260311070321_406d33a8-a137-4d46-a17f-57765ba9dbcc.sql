
-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance (user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance (status);

-- Leave requests indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests (status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests (start_date, end_date);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles (company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles (manager_id);

-- Payroll indexes
CREATE INDEX IF NOT EXISTS idx_payroll_runs_user_month ON public.payroll_runs (user_id, month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON public.payroll_runs (status);

-- User roles index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON public.notifications (company_id);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at);

-- Leave balances index
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON public.leave_balances (user_id, year);

-- Announcements index
CREATE INDEX IF NOT EXISTS idx_announcements_company_id ON public.announcements (company_id);

-- Employee documents index
CREATE INDEX IF NOT EXISTS idx_employee_documents_user_company ON public.employee_documents (user_id, company_id);

-- Salary structures index
CREATE INDEX IF NOT EXISTS idx_salary_structures_user_active ON public.salary_structures (user_id, is_active);

-- =============================================
-- AUDIT TRIGGERS for critical tables
-- =============================================

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_critical_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'INSERT', TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_value, new_value)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'UPDATE', TG_TABLE_NAME, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_value)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'DELETE', TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Payroll audit trigger
DROP TRIGGER IF EXISTS audit_payroll_changes ON public.payroll_runs;
CREATE TRIGGER audit_payroll_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_change();

-- Leave requests audit trigger
DROP TRIGGER IF EXISTS audit_leave_changes ON public.leave_requests;
CREATE TRIGGER audit_leave_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_change();

-- Attendance audit trigger (only UPDATE/DELETE to avoid noise from check-ins)
DROP TRIGGER IF EXISTS audit_attendance_changes ON public.attendance;
CREATE TRIGGER audit_attendance_changes
  AFTER UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_change();

-- Salary structure audit trigger
DROP TRIGGER IF EXISTS audit_salary_changes ON public.salary_structures;
CREATE TRIGGER audit_salary_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.salary_structures
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_change();

-- Profile changes audit trigger
DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_change();
