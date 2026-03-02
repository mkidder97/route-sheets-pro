
-- TABLE 1: cm_projects
CREATE TABLE cm_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  ri_number TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  membrane_type TEXT,
  contract_start_date DATE,
  contract_completion_date DATE,
  total_contract_days INTEGER,
  owner_company TEXT,
  owner_address TEXT,
  owner_city_state_zip TEXT,
  owner_contacts JSONB NOT NULL DEFAULT '[]',
  contractor_id UUID,
  contractor_contacts JSONB NOT NULL DEFAULT '[]',
  cc_list JSONB NOT NULL DEFAULT '[]',
  scope_pdf_path TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cm_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cm_projects_authenticated" ON cm_projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_cm_projects_updated_at
  BEFORE UPDATE ON cm_projects FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- TABLE 2: cm_project_sections
CREATE TABLE cm_project_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cm_project_id UUID NOT NULL REFERENCES cm_projects(id) ON DELETE CASCADE,
  section_title TEXT NOT NULL,
  checklist_items JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cm_project_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cm_project_sections_authenticated" ON cm_project_sections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_cm_project_sections_updated_at
  BEFORE UPDATE ON cm_project_sections FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- TABLE 3: cm_visits
CREATE TABLE cm_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cm_project_id UUID NOT NULL REFERENCES cm_projects(id) ON DELETE CASCADE,
  visit_number INTEGER NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  inspector_id UUID REFERENCES user_profiles(id),
  src_associate_id UUID REFERENCES user_profiles(id),
  weather_rain_pct TEXT,
  weather_wind_mph TEXT,
  weather_temp_range TEXT,
  overview_narrative TEXT,
  completion_tpo_delivered_pct INTEGER,
  completion_membrane_pct INTEGER,
  completion_flashing_pct INTEGER,
  completion_sheet_metal_pct INTEGER,
  schedule_days_used INTEGER,
  schedule_weather_days_credited INTEGER NOT NULL DEFAULT 0,
  schedule_days_remaining INTEGER,
  unit_qty_infill_sf INTEGER NOT NULL DEFAULT 0,
  unit_qty_deck_coating_sf INTEGER NOT NULL DEFAULT 0,
  unit_qty_deck_replaced_sf INTEGER NOT NULL DEFAULT 0,
  general_notes TEXT,
  internal_notes TEXT,
  pdf_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cm_project_id, visit_number)
);

ALTER TABLE cm_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cm_visits_authenticated" ON cm_visits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_cm_visits_updated_at
  BEFORE UPDATE ON cm_visits FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-set visit_number on insert
CREATE OR REPLACE FUNCTION set_cm_visit_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visit_number IS NULL THEN
    SELECT COALESCE(MAX(visit_number), 0) + 1
    INTO NEW.visit_number
    FROM cm_visits
    WHERE cm_project_id = NEW.cm_project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_set_cm_visit_number
  BEFORE INSERT ON cm_visits
  FOR EACH ROW EXECUTE FUNCTION set_cm_visit_number();

-- TABLE 4: cm_visit_sections
CREATE TABLE cm_visit_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cm_visit_id UUID NOT NULL REFERENCES cm_visits(id) ON DELETE CASCADE,
  cm_project_section_id UUID REFERENCES cm_project_sections(id),
  section_title TEXT NOT NULL,
  checklist_items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cm_visit_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cm_visit_sections_authenticated" ON cm_visit_sections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_cm_visit_sections_updated_at
  BEFORE UPDATE ON cm_visit_sections FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- TABLE 5: cm_photos
CREATE TABLE cm_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cm_visit_id UUID NOT NULL REFERENCES cm_visits(id) ON DELETE CASCADE,
  photo_number INTEGER NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cm_visit_id, photo_number)
);

ALTER TABLE cm_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cm_photos_authenticated" ON cm_photos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket: cm-reports (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cm-reports', 'cm-reports', true);

CREATE POLICY "cm_reports_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'cm-reports');

CREATE POLICY "cm_reports_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cm-reports');

CREATE POLICY "cm_reports_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'cm-reports');

CREATE POLICY "cm_reports_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'cm-reports');
