
-- A) Add inspection_type to inspection_campaigns
ALTER TABLE public.inspection_campaigns
  ADD COLUMN inspection_type text NOT NULL DEFAULT 'annual';

ALTER TABLE public.inspection_campaigns
  ADD CONSTRAINT inspection_campaigns_type_check
  CHECK (inspection_type IN ('annual', 'due_diligence', 'survey', 'storm'));

-- B) Create campaign_buildings junction table
CREATE TABLE public.campaign_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.inspection_campaigns(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  inspection_status text NOT NULL DEFAULT 'pending'
    CHECK (inspection_status IN ('pending', 'in_progress', 'complete', 'skipped', 'needs_revisit')),
  inspector_id uuid REFERENCES public.inspectors(id),
  scheduled_week text,
  is_priority boolean NOT NULL DEFAULT false,
  completion_date date,
  inspector_notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, building_id)
);

CREATE INDEX idx_cb_campaign ON public.campaign_buildings(campaign_id);
CREATE INDEX idx_cb_building ON public.campaign_buildings(building_id);
CREATE INDEX idx_cb_status ON public.campaign_buildings(inspection_status);

-- C) Enable RLS
ALTER TABLE public.campaign_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage campaign_buildings"
  ON public.campaign_buildings
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
