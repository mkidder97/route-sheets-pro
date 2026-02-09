-- Add DELETE policies for clients, regions, inspectors
CREATE POLICY "Public delete clients"
ON public.clients FOR DELETE USING (true);

CREATE POLICY "Public delete regions"
ON public.regions FOR DELETE USING (true);

CREATE POLICY "Public delete inspectors"
ON public.inspectors FOR DELETE USING (true);