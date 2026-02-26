

# Phase 12 File Storage: building_documents Table and building-files Bucket

## Summary
Create a new `building_documents` table for tracking file metadata and a private `building-files` storage bucket with role-based RLS policies. No changes to existing tables or the `cad-drawings` bucket.

## Database Migration

A single migration will execute the following:

### 1. building_documents table
- Columns: id (PK), building_id (FK to buildings with CASCADE delete), uploaded_by (FK to user_profiles), file_name, file_path, file_size, file_type, category (default 'other'), created_at
- RLS enabled with three policies:
  - SELECT: all authenticated users
  - INSERT: admin and office_manager roles (checked via user_roles table)
  - DELETE: admin and office_manager roles

### 2. building-files storage bucket
- Private bucket (public = false)
- 50MB file size limit
- No MIME type restrictions

### 3. Storage RLS policies on storage.objects
- **SELECT**: authenticated users can read objects in `building-files` bucket
- **INSERT**: admin and office_manager roles can upload
- **DELETE**: admin and office_manager roles can delete

### Storage path conventions (enforced by application code, not SQL)
- Documents: `{building_id}/documents/{timestamp}-{filename}`
- Roof section photos: `{building_id}/roof-sections/{section_id}/{type}-{timestamp}.{ext}`

## Technical Details

The full SQL migration:

```text
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

-- Table RLS (3 policies)
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
```

No code changes needed -- this is infrastructure-only for Phase 12.

