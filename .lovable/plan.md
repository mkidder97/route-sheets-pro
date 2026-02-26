

# Create inspection_findings Table

## Summary
Create the `inspection_findings` table with proper RLS policies using `has_ops_role()` instead of JWT claims (which don't work with this project's custom role system).

## Migration SQL

```sql
CREATE TABLE IF NOT EXISTS inspection_findings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id     uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  inspection_date date NOT NULL,
  narrative       text,
  is_in_progress  boolean DEFAULT false,
  inspector_id    uuid REFERENCES inspectors(id),
  campaign_id     uuid REFERENCES inspection_campaigns(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE inspection_findings ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users
CREATE POLICY "auth read findings"
  ON inspection_findings FOR SELECT TO authenticated
  USING (true);

-- Insert: admin, office_manager, field_ops
CREATE POLICY "Role insert findings"
  ON inspection_findings FOR INSERT TO authenticated
  WITH CHECK (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

-- Update: admin, office_manager, field_ops
CREATE POLICY "Role update findings"
  ON inspection_findings FOR UPDATE TO authenticated
  USING (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

-- Delete: admin only
CREATE POLICY "Admin delete findings"
  ON inspection_findings FOR DELETE TO authenticated
  USING (has_ops_role(auth.uid(), 'admin'::ops_role));

-- updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON inspection_findings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Key difference from your SQL
Your provided SQL uses `(auth.jwt() ->> 'role')` which does not work in this project -- roles live in the `user_roles` table, not in JWT claims. The policies above use `has_ops_role()` (the security-definer function), matching every other table in the app.

## RLS breakdown
- **SELECT**: All authenticated users (matches buildings, inspectors, etc.)
- **INSERT/UPDATE**: admin + office_manager + field_ops (field_ops included since inspectors create findings)
- **DELETE**: admin only (matches the project convention)

## Bonus
Added an `updated_at` trigger using the existing `update_updated_at_column()` function so the timestamp auto-updates on edits.

## No code changes needed
This is a schema-only migration. The types file will auto-regenerate after the migration runs.

