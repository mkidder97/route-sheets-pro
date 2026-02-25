
-- Add missing columns to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Create contacts table
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  title text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Role insert contacts" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (has_ops_role(auth.uid(), 'admin'::ops_role)
           OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

CREATE POLICY "Role update contacts" ON public.contacts
  FOR UPDATE TO authenticated
  USING (has_ops_role(auth.uid(), 'admin'::ops_role)
      OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
      OR has_ops_role(auth.uid(), 'field_ops'::ops_role));

CREATE POLICY "Admin delete contacts" ON public.contacts
  FOR DELETE TO authenticated
  USING (has_ops_role(auth.uid(), 'admin'::ops_role));
