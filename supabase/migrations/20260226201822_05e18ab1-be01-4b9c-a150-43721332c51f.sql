
-- Fix roof_sections RLS: replace JWT-based ALL policy with has_ops_role() policies
DROP POLICY IF EXISTS "admin write roof_sections" ON public.roof_sections;

CREATE POLICY "Role insert roof_sections" ON public.roof_sections
FOR INSERT TO authenticated
WITH CHECK (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

CREATE POLICY "Role update roof_sections" ON public.roof_sections
FOR UPDATE TO authenticated
USING (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

CREATE POLICY "Admin delete roof_sections" ON public.roof_sections
FOR DELETE TO authenticated
USING (has_ops_role(auth.uid(), 'admin'::ops_role));

-- Fix roof_assembly_layers RLS: replace JWT-based ALL policy with has_ops_role() policies
DROP POLICY IF EXISTS "admin write assembly_layers" ON public.roof_assembly_layers;

CREATE POLICY "Role insert assembly_layers" ON public.roof_assembly_layers
FOR INSERT TO authenticated
WITH CHECK (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

CREATE POLICY "Role update assembly_layers" ON public.roof_assembly_layers
FOR UPDATE TO authenticated
USING (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

CREATE POLICY "Admin delete assembly_layers" ON public.roof_assembly_layers
FOR DELETE TO authenticated
USING (has_ops_role(auth.uid(), 'admin'::ops_role));
