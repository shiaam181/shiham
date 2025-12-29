-- Create storage bucket for employee photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-photos', 
  'employee-photos', 
  false, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- RLS policies for employee-photos bucket
-- Users can upload their own photos (selfies for check-in/check-out)
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own photos
CREATE POLICY "Users can view their own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'employee-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own photos
CREATE POLICY "Users can update their own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'employee-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own photos
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can view all photos
CREATE POLICY "Admins can view all employee photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'employee-photos' AND
  public.is_admin()
);

-- Admins can delete any photo
CREATE POLICY "Admins can delete any employee photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-photos' AND
  public.is_admin()
);