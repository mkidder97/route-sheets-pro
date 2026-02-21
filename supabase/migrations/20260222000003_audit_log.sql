-- Fix M-2: Add audit logging for admin and data-changing actions

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins read audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_ops_role(auth.uid(), 'admin'::ops_role));

-- Any authenticated user can write logs (the edge function writes on their behalf)
CREATE POLICY "Authenticated insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
