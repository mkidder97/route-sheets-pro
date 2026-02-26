
-- 1. building_documents table
CREATE TABLE building_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES user_profiles(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  category TEXT DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE building_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view building documents"
  ON building_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and office managers can insert building documents"
  ON building_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','office_manager')
  ));

CREATE POLICY "Admins and office managers can delete building documents"
  ON building_documents FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','office_manager')
  ));

-- 2. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('building-files', 'building-files', false, 52428800);

-- 3. Storage RLS policies
CREATE POLICY "Authenticated read building-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'building-files');

CREATE POLICY "Admin/office_manager upload building-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'building-files'
    AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','office_manager')
    )
  );

CREATE POLICY "Admin/office_manager delete building-files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'building-files'
    AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','office_manager')
    )
  );
