
-- Lock down RoofRoute tables: replace "Public *" with "Authenticated *"

-- Also drop any "Public delete" on clients, regions, inspectors, uploads
DROP POLICY IF EXISTS "Public delete clients" ON public.clients;
DROP POLICY IF EXISTS "Public delete regions" ON public.regions;
DROP POLICY IF EXISTS "Public delete inspectors" ON public.inspectors;
DROP POLICY IF EXISTS "Public delete uploads" ON public.uploads;

-- CLIENTS
DROP POLICY IF EXISTS "Public read clients" ON public.clients;
DROP POLICY IF EXISTS "Public insert clients" ON public.clients;
DROP POLICY IF EXISTS "Public update clients" ON public.clients;
CREATE POLICY "Authenticated read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update clients" ON public.clients FOR UPDATE TO authenticated USING (true);

-- REGIONS
DROP POLICY IF EXISTS "Public read regions" ON public.regions;
DROP POLICY IF EXISTS "Public insert regions" ON public.regions;
DROP POLICY IF EXISTS "Public update regions" ON public.regions;
CREATE POLICY "Authenticated read regions" ON public.regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert regions" ON public.regions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update regions" ON public.regions FOR UPDATE TO authenticated USING (true);

-- INSPECTORS
DROP POLICY IF EXISTS "Public read inspectors" ON public.inspectors;
DROP POLICY IF EXISTS "Public insert inspectors" ON public.inspectors;
DROP POLICY IF EXISTS "Public update inspectors" ON public.inspectors;
CREATE POLICY "Authenticated read inspectors" ON public.inspectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert inspectors" ON public.inspectors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update inspectors" ON public.inspectors FOR UPDATE TO authenticated USING (true);

-- UPLOADS
DROP POLICY IF EXISTS "Public read uploads" ON public.uploads;
DROP POLICY IF EXISTS "Public insert uploads" ON public.uploads;
DROP POLICY IF EXISTS "Public update uploads" ON public.uploads;
CREATE POLICY "Authenticated read uploads" ON public.uploads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert uploads" ON public.uploads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update uploads" ON public.uploads FOR UPDATE TO authenticated USING (true);

-- BUILDINGS
DROP POLICY IF EXISTS "Public read buildings" ON public.buildings;
DROP POLICY IF EXISTS "Public insert buildings" ON public.buildings;
DROP POLICY IF EXISTS "Public update buildings" ON public.buildings;
DROP POLICY IF EXISTS "Public delete buildings" ON public.buildings;
CREATE POLICY "Authenticated read buildings" ON public.buildings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert buildings" ON public.buildings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update buildings" ON public.buildings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete buildings" ON public.buildings FOR DELETE TO authenticated USING (true);

-- ROUTE_PLANS
DROP POLICY IF EXISTS "Public read route_plans" ON public.route_plans;
DROP POLICY IF EXISTS "Public insert route_plans" ON public.route_plans;
DROP POLICY IF EXISTS "Public update route_plans" ON public.route_plans;
DROP POLICY IF EXISTS "Public delete route_plans" ON public.route_plans;
CREATE POLICY "Authenticated read route_plans" ON public.route_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert route_plans" ON public.route_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update route_plans" ON public.route_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete route_plans" ON public.route_plans FOR DELETE TO authenticated USING (true);

-- ROUTE_PLAN_DAYS
DROP POLICY IF EXISTS "Public read route_plan_days" ON public.route_plan_days;
DROP POLICY IF EXISTS "Public insert route_plan_days" ON public.route_plan_days;
DROP POLICY IF EXISTS "Public update route_plan_days" ON public.route_plan_days;
DROP POLICY IF EXISTS "Public delete route_plan_days" ON public.route_plan_days;
CREATE POLICY "Authenticated read route_plan_days" ON public.route_plan_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert route_plan_days" ON public.route_plan_days FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update route_plan_days" ON public.route_plan_days FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete route_plan_days" ON public.route_plan_days FOR DELETE TO authenticated USING (true);

-- ROUTE_PLAN_BUILDINGS
DROP POLICY IF EXISTS "Public read route_plan_buildings" ON public.route_plan_buildings;
DROP POLICY IF EXISTS "Public insert route_plan_buildings" ON public.route_plan_buildings;
DROP POLICY IF EXISTS "Public update route_plan_buildings" ON public.route_plan_buildings;
DROP POLICY IF EXISTS "Public delete route_plan_buildings" ON public.route_plan_buildings;
CREATE POLICY "Authenticated read route_plan_buildings" ON public.route_plan_buildings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert route_plan_buildings" ON public.route_plan_buildings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update route_plan_buildings" ON public.route_plan_buildings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete route_plan_buildings" ON public.route_plan_buildings FOR DELETE TO authenticated USING (true);

-- Also lock down generated_documents (currently public)
DROP POLICY IF EXISTS "Public read generated_documents" ON public.generated_documents;
DROP POLICY IF EXISTS "Public insert generated_documents" ON public.generated_documents;
DROP POLICY IF EXISTS "Public delete generated_documents" ON public.generated_documents;
CREATE POLICY "Authenticated read generated_documents" ON public.generated_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert generated_documents" ON public.generated_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete generated_documents" ON public.generated_documents FOR DELETE TO authenticated USING (true);
