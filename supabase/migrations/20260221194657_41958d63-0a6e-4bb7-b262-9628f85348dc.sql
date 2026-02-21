
-- Mileage logs: one entry per user per day
CREATE TABLE public.mileage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id),
  date DATE NOT NULL,
  miles NUMERIC(7,1) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Mileage approvals: one per user per week
CREATE TABLE public.mileage_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id),
  week_start DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES public.user_profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Enable RLS
ALTER TABLE public.mileage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_approvals ENABLE ROW LEVEL SECURITY;

-- mileage_logs policies
CREATE POLICY "Users read own mileage_logs"
  ON public.mileage_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin/office_manager read all mileage_logs"
  ON public.mileage_logs FOR SELECT
  USING (has_ops_role(auth.uid(), 'admin') OR has_ops_role(auth.uid(), 'office_manager'));

CREATE POLICY "Users insert own mileage_logs"
  ON public.mileage_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own mileage_logs"
  ON public.mileage_logs FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own mileage_logs"
  ON public.mileage_logs FOR DELETE
  USING (user_id = auth.uid());

-- mileage_approvals policies
CREATE POLICY "Users read own mileage_approvals"
  ON public.mileage_approvals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin/office_manager read all mileage_approvals"
  ON public.mileage_approvals FOR SELECT
  USING (has_ops_role(auth.uid(), 'admin') OR has_ops_role(auth.uid(), 'office_manager'));

CREATE POLICY "Users insert own mileage_approvals"
  ON public.mileage_approvals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own mileage_approvals"
  ON public.mileage_approvals FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admin/office_manager update mileage_approvals"
  ON public.mileage_approvals FOR UPDATE
  USING (has_ops_role(auth.uid(), 'admin') OR has_ops_role(auth.uid(), 'office_manager'));

-- Triggers for updated_at
CREATE TRIGGER update_mileage_logs_updated_at
  BEFORE UPDATE ON public.mileage_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
