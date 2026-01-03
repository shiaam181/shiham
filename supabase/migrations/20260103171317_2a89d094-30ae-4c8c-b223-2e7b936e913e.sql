-- Make the employee-photos bucket public so photos can be viewed
UPDATE storage.buckets SET public = true WHERE id = 'employee-photos';

-- Add RLS policy for authenticated users to view all photos (needed for signed URLs if bucket stays private)
DROP POLICY IF EXISTS "Admins can view all employee photos" ON storage.objects;
CREATE POLICY "Admins can view all employee photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'employee-photos' AND is_admin());