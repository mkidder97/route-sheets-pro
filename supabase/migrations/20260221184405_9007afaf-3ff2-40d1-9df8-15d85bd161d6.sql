
-- =============================================
-- CM Job Types
-- =============================================
CREATE TABLE public.cm_job_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  statuses JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cm_job_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read cm_job_types"
  ON public.cm_job_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/office_manager manage cm_job_types"
  ON public.cm_job_types FOR ALL
  USING (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role))
  WITH CHECK (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

-- =============================================
-- CM Jobs
-- =============================================
CREATE TABLE public.cm_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type_id UUID NOT NULL REFERENCES public.cm_job_types(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  region_id UUID REFERENCES public.regions(id),
  building_id UUID REFERENCES public.buildings(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  assigned_to UUID REFERENCES public.user_profiles(id),
  priority TEXT NOT NULL DEFAULT 'normal',
  scheduled_date DATE,
  due_date DATE,
  property_manager_name TEXT,
  property_manager_phone TEXT,
  property_manager_email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cm_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read cm_jobs"
  ON public.cm_jobs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/office_manager insert cm_jobs"
  ON public.cm_jobs FOR INSERT
  WITH CHECK (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

CREATE POLICY "Admin/office_manager update cm_jobs"
  ON public.cm_jobs FOR UPDATE
  USING (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

CREATE POLICY "Assigned user update own cm_jobs"
  ON public.cm_jobs FOR UPDATE
  USING (assigned_to = auth.uid());

CREATE POLICY "Admin/office_manager delete cm_jobs"
  ON public.cm_jobs FOR DELETE
  USING (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

CREATE TRIGGER update_cm_jobs_updated_at
  BEFORE UPDATE ON public.cm_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- CM Job Status History
-- =============================================
CREATE TABLE public.cm_job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cm_job_id UUID NOT NULL REFERENCES public.cm_jobs(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cm_job_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read cm_job_status_history"
  ON public.cm_job_status_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated insert cm_job_status_history"
  ON public.cm_job_status_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- Seed: Roof Replacement job type
-- =============================================
INSERT INTO public.cm_job_types (name, description, statuses) VALUES (
  'Roof Replacement',
  'Full roof replacement workflow from client approval through construction to completion.',
  '[
    {"key": "approved", "label": "Client Approved", "color": "#3498DB", "owner_role": "office_manager", "order": 1},
    {"key": "takeoff_scheduled", "label": "Take-Off Scheduled", "color": "#9B59B6", "owner_role": "office_manager", "order": 2},
    {"key": "takeoff_in_progress", "label": "Take-Off In Progress", "color": "#E67E22", "owner_role": "field_ops", "order": 3},
    {"key": "takeoff_complete", "label": "Take-Off Complete", "color": "#27AE60", "owner_role": "field_ops", "order": 4},
    {"key": "engineering_review", "label": "Engineering Review", "color": "#E74C3C", "owner_role": "engineer", "order": 5},
    {"key": "scope_complete", "label": "Scope Complete", "color": "#27AE60", "owner_role": "engineer", "order": 6},
    {"key": "prebid_scheduling", "label": "Pre-Bid Scheduling", "color": "#9B59B6", "owner_role": "office_manager", "order": 7},
    {"key": "prebid", "label": "Pre-Bid", "color": "#E67E22", "owner_role": "field_ops", "order": 8},
    {"key": "precon", "label": "Pre-Con", "color": "#E67E22", "owner_role": "field_ops", "order": 9},
    {"key": "construction", "label": "Construction", "color": "#3498DB", "owner_role": "field_ops", "order": 10},
    {"key": "complete", "label": "Complete", "color": "#27AE60", "owner_role": "office_manager", "order": 11}
  ]'::jsonb
);
