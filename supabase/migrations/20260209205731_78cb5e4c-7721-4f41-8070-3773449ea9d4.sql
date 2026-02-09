
-- Enums
CREATE TYPE public.region_status AS ENUM ('not_started', 'in_progress', 'complete');
CREATE TYPE public.roof_access_type AS ENUM ('roof_hatch', 'exterior_ladder', 'interior_ladder', 'ground_level', 'other');

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Public insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update clients" ON public.clients FOR UPDATE USING (true);

-- Regions
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status region_status NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, name)
);
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read regions" ON public.regions FOR SELECT USING (true);
CREATE POLICY "Public insert regions" ON public.regions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update regions" ON public.regions FOR UPDATE USING (true);

-- Inspectors
CREATE TABLE public.inspectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inspectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read inspectors" ON public.inspectors FOR SELECT USING (true);
CREATE POLICY "Public insert inspectors" ON public.inspectors FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update inspectors" ON public.inspectors FOR UPDATE USING (true);

-- Buildings
CREATE TABLE public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  inspector_id UUID REFERENCES public.inspectors(id) ON DELETE SET NULL,
  roof_group TEXT,
  building_code TEXT,
  stop_number TEXT,
  property_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  inspection_date TEXT,
  scheduled_week TEXT,
  square_footage INTEGER,
  roof_access_type roof_access_type DEFAULT 'other',
  roof_access_description TEXT,
  access_location TEXT,
  lock_gate_codes TEXT,
  special_notes TEXT,
  requires_advance_notice BOOLEAN DEFAULT false,
  requires_escort BOOLEAN DEFAULT false,
  special_equipment TEXT[],
  is_priority BOOLEAN DEFAULT false,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read buildings" ON public.buildings FOR SELECT USING (true);
CREATE POLICY "Public insert buildings" ON public.buildings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update buildings" ON public.buildings FOR UPDATE USING (true);
CREATE POLICY "Public delete buildings" ON public.buildings FOR DELETE USING (true);

-- Uploads tracking
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read uploads" ON public.uploads FOR SELECT USING (true);
CREATE POLICY "Public insert uploads" ON public.uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update uploads" ON public.uploads FOR UPDATE USING (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON public.regions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inspectors_updated_at BEFORE UPDATE ON public.inspectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
