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

CREATE POLICY "auth read findings"
  ON inspection_findings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Role insert findings"
  ON inspection_findings FOR INSERT TO authenticated
  WITH CHECK (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Role update findings"
  ON inspection_findings FOR UPDATE TO authenticated
  USING (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Admin delete findings"
  ON inspection_findings FOR DELETE TO authenticated
  USING (has_ops_role(auth.uid(), 'admin'::ops_role));

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON inspection_findings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();