
-- Route Plans table
CREATE TABLE public.route_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  region_id UUID NOT NULL REFERENCES public.regions(id),
  inspector_id UUID NOT NULL REFERENCES public.inspectors(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  buildings_per_day INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.route_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read route_plans" ON public.route_plans FOR SELECT USING (true);
CREATE POLICY "Public insert route_plans" ON public.route_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update route_plans" ON public.route_plans FOR UPDATE USING (true);
CREATE POLICY "Public delete route_plans" ON public.route_plans FOR DELETE USING (true);

CREATE TRIGGER update_route_plans_updated_at
  BEFORE UPDATE ON public.route_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Route Plan Days table
CREATE TABLE public.route_plan_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_plan_id UUID NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  day_date DATE NOT NULL,
  estimated_distance_miles NUMERIC DEFAULT 0
);

ALTER TABLE public.route_plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read route_plan_days" ON public.route_plan_days FOR SELECT USING (true);
CREATE POLICY "Public insert route_plan_days" ON public.route_plan_days FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update route_plan_days" ON public.route_plan_days FOR UPDATE USING (true);
CREATE POLICY "Public delete route_plan_days" ON public.route_plan_days FOR DELETE USING (true);

-- Route Plan Buildings junction table
CREATE TABLE public.route_plan_buildings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_plan_day_id UUID NOT NULL REFERENCES public.route_plan_days(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.route_plan_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read route_plan_buildings" ON public.route_plan_buildings FOR SELECT USING (true);
CREATE POLICY "Public insert route_plan_buildings" ON public.route_plan_buildings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update route_plan_buildings" ON public.route_plan_buildings FOR UPDATE USING (true);
CREATE POLICY "Public delete route_plan_buildings" ON public.route_plan_buildings FOR DELETE USING (true);
