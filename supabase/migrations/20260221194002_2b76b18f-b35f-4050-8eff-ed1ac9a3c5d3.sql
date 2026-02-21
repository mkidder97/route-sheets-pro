
-- Create scheduling_events table
CREATE TABLE public.scheduling_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspector_id UUID REFERENCES public.inspectors(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'other_visit',
  start_date DATE NOT NULL,
  end_date DATE,
  reference_type TEXT,
  reference_id UUID,
  color TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default end_date to start_date via trigger
CREATE OR REPLACE FUNCTION public.default_scheduling_end_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.end_date IS NULL THEN
    NEW.end_date := NEW.start_date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_scheduling_end_date
  BEFORE INSERT OR UPDATE ON public.scheduling_events
  FOR EACH ROW
  EXECUTE FUNCTION public.default_scheduling_end_date();

-- Updated_at trigger
CREATE TRIGGER update_scheduling_events_updated_at
  BEFORE UPDATE ON public.scheduling_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.scheduling_events ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated read scheduling_events"
  ON public.scheduling_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin/office_manager can insert
CREATE POLICY "Admin/office_manager insert scheduling_events"
  ON public.scheduling_events
  FOR INSERT
  WITH CHECK (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

-- Admin/office_manager can update
CREATE POLICY "Admin/office_manager update scheduling_events"
  ON public.scheduling_events
  FOR UPDATE
  USING (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

-- Admin/office_manager can delete
CREATE POLICY "Admin/office_manager delete scheduling_events"
  ON public.scheduling_events
  FOR DELETE
  USING (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );
