
CREATE TABLE public.generated_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_plan_id uuid REFERENCES public.route_plans(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  inspector_id uuid REFERENCES public.inspectors(id) ON DELETE SET NULL,
  format text NOT NULL DEFAULT 'pdf',
  file_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read generated_documents" ON public.generated_documents FOR SELECT USING (true);
CREATE POLICY "Public insert generated_documents" ON public.generated_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete generated_documents" ON public.generated_documents FOR DELETE USING (true);
