-- 1. Set bucket to private
UPDATE storage.buckets SET public = false WHERE id = 'cad-drawings';

-- 2. Drop existing permissive policies
DROP POLICY IF EXISTS "Public upload cad drawings" ON storage.objects;
DROP POLICY IF EXISTS "Public read cad drawings" ON storage.objects;

-- 3. Authenticated read
CREATE POLICY "Authenticated read cad drawings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'cad-drawings');

-- 4. Admin/OM upload only
CREATE POLICY "Admin/OM upload cad drawings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cad-drawings'
  AND (
    public.has_ops_role(auth.uid(), 'admin')
    OR public.has_ops_role(auth.uid(), 'office_manager')
  )
);