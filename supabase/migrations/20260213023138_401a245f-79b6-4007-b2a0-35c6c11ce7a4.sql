
-- Create inspection_campaigns table
CREATE TABLE public.inspection_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  region_id UUID NOT NULL REFERENCES public.regions(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'complete', 'on_hold')),
  total_buildings INTEGER NOT NULL DEFAULT 0,
  completed_buildings INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspection_campaigns ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read campaigns"
  ON public.inspection_campaigns
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin/office_manager can insert
CREATE POLICY "Admin/office_manager can insert campaigns"
  ON public.inspection_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

-- Admin/office_manager can update
CREATE POLICY "Admin/office_manager can update campaigns"
  ON public.inspection_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

-- Admin/office_manager can delete
CREATE POLICY "Admin/office_manager can delete campaigns"
  ON public.inspection_campaigns
  FOR DELETE
  TO authenticated
  USING (
    has_ops_role(auth.uid(), 'admin'::ops_role)
    OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

-- Trigger for updated_at
CREATE TRIGGER update_inspection_campaigns_updated_at
  BEFORE UPDATE ON public.inspection_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
