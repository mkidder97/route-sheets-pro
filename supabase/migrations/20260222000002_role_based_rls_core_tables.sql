-- Fix C-3/H-1: Replace flat "Authenticated *" policies with role-based policies
-- Pattern:
--   SELECT  = all authenticated (internal tool, read access is fine)
--   INSERT  = admin + office_manager only
--   UPDATE  = admin + office_manager + field_ops (inspectors update buildings)
--   DELETE  = admin only

-- ============================================
-- CLIENTS
-- ============================================
DROP POLICY IF EXISTS "Authenticated insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated update clients" ON public.clients;

CREATE POLICY "Role insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

CREATE POLICY "Role update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

-- ============================================
-- REGIONS
-- ============================================
DROP POLICY IF EXISTS "Authenticated insert regions" ON public.regions;
DROP POLICY IF EXISTS "Authenticated update regions" ON public.regions;

CREATE POLICY "Role insert regions" ON public.regions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

CREATE POLICY "Role update regions" ON public.regions
  FOR UPDATE TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

-- ============================================
-- INSPECTORS
-- ============================================
DROP POLICY IF EXISTS "Authenticated insert inspectors" ON public.inspectors;
DROP POLICY IF EXISTS "Authenticated update inspectors" ON public.inspectors;

CREATE POLICY "Role insert inspectors" ON public.inspectors
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

CREATE POLICY "Role update inspectors" ON public.inspectors
  FOR UPDATE TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

-- ============================================
-- BUILDINGS
-- ============================================
DROP POLICY IF EXISTS "Authenticated insert buildings" ON public.buildings;
DROP POLICY IF EXISTS "Authenticated update buildings" ON public.buildings;
DROP POLICY IF EXISTS "Authenticated delete buildings" ON public.buildings;

CREATE POLICY "Role insert buildings" ON public.buildings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

CREATE POLICY "Role update buildings" ON public.buildings
  FOR UPDATE TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Admin delete buildings" ON public.buildings
  FOR DELETE TO authenticated
  USING (public.has_ops_role(auth.uid(), 'admin'::ops_role));

-- ============================================
-- UPLOADS
-- ============================================
DROP POLICY IF EXISTS "Authenticated insert uploads" ON public.uploads;
DROP POLICY IF EXISTS "Authenticated update uploads" ON public.uploads;

CREATE POLICY "Role insert uploads" ON public.uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

CREATE POLICY "Role update uploads" ON public.uploads
  FOR UPDATE TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

-- ============================================
-- ROUTE_PLANS
-- ============================================
DROP POLICY IF EXISTS "Authenticated insert route_plans" ON public.route_plans;
DROP POLICY IF EXISTS "Authenticated update route_plans" ON public.route_plans;
DROP POLICY IF EXISTS "Authenticated delete route_plans" ON public.route_plans;

CREATE POLICY "Role insert route_plans" ON public.route_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Role update route_plans" ON public.route_plans
  FOR UPDATE TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Admin delete route_plans" ON public.route_plans
  FOR DELETE TO authenticated
  USING (public.has_ops_role(auth.uid(), 'admin'::ops_role));

-- ============================================
-- ROUTE_PLAN_DAYS
-- ============================================
DROP POLICY IF EXISTS "Authenticated insert route_plan_days" ON public.route_plan_days;
DROP POLICY IF EXISTS "Authenticated update route_plan_days" ON public.route_plan_days;
DROP POLICY IF EXISTS "Authenticated delete route_plan_days" ON public.route_plan_days;

CREATE POLICY "Role insert route_plan_days" ON public.route_plan_days
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Role update route_plan_days" ON public.route_plan_days
  FOR UPDATE TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Admin delete route_plan_days" ON public.route_plan_days
  FOR DELETE TO authenticated
  USING (public.has_ops_role(auth.uid(), 'admin'::ops_role));

-- ============================================
-- ROUTE_PLAN_BUILDINGS
-- ============================================
DROP POLICY IF EXISTS "Authenticated insert route_plan_buildings" ON public.route_plan_buildings;
DROP POLICY IF EXISTS "Authenticated update route_plan_buildings" ON public.route_plan_buildings;
DROP POLICY IF EXISTS "Authenticated delete route_plan_buildings" ON public.route_plan_buildings;

CREATE POLICY "Role insert route_plan_buildings" ON public.route_plan_buildings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Role update route_plan_buildings" ON public.route_plan_buildings
  FOR UPDATE TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Admin delete route_plan_buildings" ON public.route_plan_buildings
  FOR DELETE TO authenticated
  USING (public.has_ops_role(auth.uid(), 'admin'::ops_role));

-- ============================================
-- GENERATED_DOCUMENTS
-- ============================================
DROP POLICY IF EXISTS "Authenticated insert generated_documents" ON public.generated_documents;
DROP POLICY IF EXISTS "Authenticated delete generated_documents" ON public.generated_documents;

CREATE POLICY "Role insert generated_documents" ON public.generated_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

CREATE POLICY "Admin delete generated_documents" ON public.generated_documents
  FOR DELETE TO authenticated
  USING (public.has_ops_role(auth.uid(), 'admin'::ops_role));
