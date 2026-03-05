

## Fix CAD Drawings Storage Bucket RLS

### Current State
- Bucket `cad-drawings` is **public** (`public: true`)
- Two permissive policies grant unrestricted access to the `public` role (i.e., everyone):
  - "Public upload cad drawings" — INSERT for anyone
  - "Public read cad drawings" — SELECT for anyone

### Changes (database migration only, no app code changes)

**1. Set bucket to private**
```sql
UPDATE storage.buckets SET public = false WHERE id = 'cad-drawings';
```

**2. Drop existing permissive policies**
```sql
DROP POLICY "Public upload cad drawings" ON storage.objects;
DROP POLICY "Public read cad drawings" ON storage.objects;
```

**3. Create new role-gated policies**

- **SELECT** — any authenticated user can read:
```sql
CREATE POLICY "Authenticated read cad drawings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'cad-drawings');
```

- **INSERT** — only admin or office_manager can upload:
```sql
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
```

### Files Modified
- None — database migration only

### Not Changed
- `building-files` and `cm-reports` buckets
- Any application code

