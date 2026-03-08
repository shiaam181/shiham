
-- Create employee_documents table
CREATE TABLE public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'other',
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Employees can view their own documents
CREATE POLICY "Users can view own documents"
ON public.employee_documents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins/HR can manage company documents
CREATE POLICY "Admins can manage company documents"
ON public.employee_documents FOR ALL
TO authenticated
USING (
  (is_admin() OR is_hr() OR is_owner()) 
  AND company_id = get_user_company_id(auth.uid())
)
WITH CHECK (
  (is_admin() OR is_hr() OR is_owner()) 
  AND company_id = get_user_company_id(auth.uid())
);

-- Developers can manage all documents
CREATE POLICY "Developers can manage all documents"
ON public.employee_documents FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

-- Employees can upload their own documents
CREATE POLICY "Users can insert own documents"
ON public.employee_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Employees can delete their own documents
CREATE POLICY "Users can delete own documents"
ON public.employee_documents FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can upload to their own folder
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can view their own documents
CREATE POLICY "Users can view own document files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can delete their own documents
CREATE POLICY "Users can delete own document files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can access all documents in their company (via edge function or service role)
CREATE POLICY "Admins can view all document files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-documents' AND (is_admin() OR is_hr() OR is_owner() OR has_role(auth.uid(), 'developer'::app_role)));

CREATE POLICY "Admins can delete document files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-documents' AND (is_admin() OR is_hr() OR is_owner() OR has_role(auth.uid(), 'developer'::app_role)));
