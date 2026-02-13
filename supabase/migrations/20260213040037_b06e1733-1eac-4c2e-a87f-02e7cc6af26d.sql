
-- Create comments table
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_comments_entity ON public.comments (entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all comments
CREATE POLICY "Authenticated read comments"
  ON public.comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert their own comments
CREATE POLICY "Authenticated insert own comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add validation trigger on campaign_buildings for inspection_status
CREATE OR REPLACE FUNCTION public.validate_campaign_building_status()
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

CREATE TRIGGER validate_campaign_building_status_trigger
  BEFORE INSERT OR UPDATE ON public.campaign_buildings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_campaign_building_status();
