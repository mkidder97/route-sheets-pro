
-- 1. CREATE TABLE inspections
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES user_profiles(id),
  campaign_id UUID REFERENCES inspection_campaigns(id),
  campaign_building_id UUID REFERENCES campaign_buildings(id),
  inspection_type TEXT NOT NULL DEFAULT 'annual',
  status TEXT NOT NULL DEFAULT 'in_progress',
  weather_conditions TEXT,
  temperature_f INTEGER,
  general_notes TEXT,
  executive_summary TEXT,
  overall_rating INTEGER,
  storm_date DATE,
  total_findings INTEGER DEFAULT 0,
  total_estimated_repair_cost NUMERIC DEFAULT 0,
  recommendation TEXT,
  internal_notes TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON inspections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inspector_insert" ON inspections
  FOR INSERT TO authenticated
  WITH CHECK (inspector_id = auth.uid());

CREATE POLICY "inspector_update_own" ON inspections
  FOR UPDATE TO authenticated
  USING (
    inspector_id = auth.uid()
    OR has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

CREATE TRIGGER update_inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. CREATE TABLE inspection_overview_photos
CREATE TABLE inspection_overview_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  roof_section_id UUID REFERENCES roof_sections(id),
  file_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inspection_overview_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON inspection_overview_photos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. ALTER inspection_findings
ALTER TABLE inspection_findings
  ADD COLUMN IF NOT EXISTS inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deficiency_number INTEGER,
  ADD COLUMN IF NOT EXISTS repair_scope TEXT,
  ADD COLUMN IF NOT EXISTS estimated_repair_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS finding_status TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

-- 4. ALTER campaign_buildings
ALTER TABLE campaign_buildings
  ADD COLUMN IF NOT EXISTS inspection_id UUID REFERENCES inspections(id),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 5. ALTER inspectors
ALTER TABLE inspectors
  ADD COLUMN IF NOT EXISTS user_profile_id UUID REFERENCES user_profiles(id) UNIQUE;
