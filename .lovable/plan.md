

# Field Inspection Module -- Migration Corrections

## Summary
Update the database migration plan to address four correctness issues before execution. No new features -- this is a pre-flight check on the SQL that will be generated.

## Corrections Required

### 1. Inspections RLS UPDATE policy: use `has_ops_role()` instead of raw EXISTS
The existing schema consistently uses the `has_ops_role()` security definer function for all RLS policies. Using a raw `EXISTS (SELECT 1 FROM user_roles ...)` would break the pattern and risk recursive RLS issues. The UPDATE policy must be:

```sql
CREATE POLICY "inspector_update_own" ON inspections
  FOR UPDATE TO authenticated
  USING (
    inspector_id = auth.uid()
    OR has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );
```

### 2. Inspections `updated_at` trigger: explicit CREATE TRIGGER required
The migration must include:

```sql
CREATE TRIGGER update_inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

Every other table with `updated_at` (clients, regions, buildings, inspectors, cm_jobs, mileage_logs, scheduling_events, inspection_findings) has this trigger explicitly created. The `inspections` table must follow the same pattern.

### 3. `inspection_findings` ALTER: use IF NOT EXISTS on all 7 new columns
The table already exists (migration `20260226203110`) with columns: id, building_id, inspection_date, narrative, is_in_progress, inspector_id, campaign_id, created_at, updated_at. The ALTER must be:

```sql
ALTER TABLE inspection_findings
  ADD COLUMN IF NOT EXISTS inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deficiency_number INTEGER,
  ADD COLUMN IF NOT EXISTS repair_scope TEXT,
  ADD COLUMN IF NOT EXISTS estimated_repair_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS finding_status TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';
```

### 4. `campaign_buildings` ALTER: use IF NOT EXISTS
```sql
ALTER TABLE campaign_buildings
  ADD COLUMN IF NOT EXISTS inspection_id UUID REFERENCES inspections(id),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

### 5. `inspectors` ALTER: use IF NOT EXISTS
```sql
ALTER TABLE inspectors
  ADD COLUMN IF NOT EXISTS user_profile_id UUID REFERENCES user_profiles(id) UNIQUE;
```

## Execution Order
All five migrations will be combined into a single SQL migration with this order:
1. CREATE TABLE inspections (with RLS policies using `has_ops_role` + trigger)
2. CREATE TABLE inspection_overview_photos (with RLS)
3. ALTER inspection_findings (IF NOT EXISTS on all columns)
4. ALTER campaign_buildings (IF NOT EXISTS)
5. ALTER inspectors (IF NOT EXISTS)

## No UI Changes
Schema only. No files created or modified beyond the migration.
