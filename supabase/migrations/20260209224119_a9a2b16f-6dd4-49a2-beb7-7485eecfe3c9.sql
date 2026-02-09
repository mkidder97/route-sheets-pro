
-- Add completion tracking columns to buildings
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS inspection_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completion_date timestamptz,
  ADD COLUMN IF NOT EXISTS inspector_notes text,
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Add a check constraint for valid statuses (as a trigger for flexibility)
CREATE OR REPLACE FUNCTION public.validate_inspection_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.inspection_status NOT IN ('pending', 'in_progress', 'complete', 'skipped', 'needs_revisit') THEN
    RAISE EXCEPTION 'Invalid inspection_status: %', NEW.inspection_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_buildings_inspection_status
  BEFORE INSERT OR UPDATE ON public.buildings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_inspection_status();

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_buildings_inspection_status ON public.buildings(inspection_status);
CREATE INDEX IF NOT EXISTS idx_buildings_client_status ON public.buildings(client_id, inspection_status);
