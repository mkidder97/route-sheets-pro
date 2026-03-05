CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
ON public.system_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

INSERT INTO public.system_settings (key, value)
VALUES ('bootstrap_completed', 'false')
ON CONFLICT (key) DO NOTHING;