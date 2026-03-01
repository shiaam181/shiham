
-- Platform payslip templates (managed by developers)
CREATE TABLE public.platform_payslip_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL DEFAULT 'html' CHECK (template_type IN ('html', 'docx')),
  template_content TEXT NOT NULL,
  preview_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_payslip_templates ENABLE ROW LEVEL SECURITY;

-- Only developers can manage
CREATE POLICY "Developers can manage platform templates"
  ON public.platform_payslip_templates FOR ALL
  USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

-- All authenticated can view active templates
CREATE POLICY "Authenticated users can view active platform templates"
  ON public.platform_payslip_templates FOR SELECT
  USING (status = 'active' AND auth.role() = 'authenticated');

-- Tenant payslip settings (per company)
CREATE TABLE public.tenant_payslip_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_mode TEXT NOT NULL DEFAULT 'default' CHECK (template_mode IN ('default', 'custom')),
  selected_platform_template_id UUID REFERENCES public.platform_payslip_templates(id),
  custom_template_content TEXT,
  tenant_logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  header_text TEXT,
  footer_text TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.tenant_payslip_settings ENABLE ROW LEVEL SECURITY;

-- Developers can manage all
CREATE POLICY "Developers can manage all tenant payslip settings"
  ON public.tenant_payslip_settings FOR ALL
  USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

-- Owner/Admin/HR can manage their company settings
CREATE POLICY "Company admins can manage payslip settings"
  ON public.tenant_payslip_settings FOR ALL
  USING (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_owner() OR is_hr()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND (is_admin() OR is_owner() OR is_hr()));

-- Employees can view their company settings (for payslip rendering)
CREATE POLICY "Employees can view own company payslip settings"
  ON public.tenant_payslip_settings FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));
