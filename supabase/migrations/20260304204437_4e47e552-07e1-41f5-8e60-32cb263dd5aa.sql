-- Seed: Harbor Freight Demo Project
-- 1. Client (required FK for buildings)
INSERT INTO clients (id, name)
VALUES ('c1000000-0000-0000-0000-000000000001', 'Realty Income Corporation')
ON CONFLICT (id) DO NOTHING;

-- 2. Building
INSERT INTO buildings (id, client_id, property_name, address, city, state, zip_code)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'Harbor Freight Tools',
  '2267 North US-81',
  'Duncan',
  'OK',
  '73533'
)
ON CONFLICT (id) DO NOTHING;

-- 3. CM Project
INSERT INTO cm_projects (
  id, building_id, project_name, ri_number, status, membrane_type,
  contract_start_date, contract_completion_date, total_contract_days,
  owner_company, owner_address, owner_city_state_zip,
  owner_contacts, contractor_name, contractor_contacts, cc_list
)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'Harbor Freight (RI #13738)',
  'RI-13738',
  'active',
  '60-mil TPO Recover',
  '2026-01-07',
  '2026-02-26',
  37,
  'Realty Income Corporation',
  '11995 El Camino Real',
  'San Diego, CA 92130',
  '[{"name":"Guy Winters","role":"AVP Capital Construction and Procurement","phone":"(858) 284-5283","email":"GWinters@realtyincome.com"},{"name":"Heather Torres","role":"Senior Construction Manager","phone":"(858) 284-5242","email":"HTorres@realtyincome.com"}]'::jsonb,
  'TBD — Awarded at Bid',
  '[]'::jsonb,
  '[{"name":"Realty Income CapEx Team","email":"CCP@realtyincome.com"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 4. Checklist sections
INSERT INTO cm_project_sections (cm_project_id, section_title, checklist_items, sort_order)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'STAGING & ACCESS', '["Ground staging area confirmed (westside rear alleyway)","Exterior landscaping, hardscaping, and paving protected","Debris chutes installed with wall protection","Safe external roof access provided (ladder or stair scaffold)","No materials stored or transported through building interior","Fall protection in place per federal/state/local requirements"]'::jsonb, 1),
  ('a1000000-0000-0000-0000-000000000001', 'DEMOLITION & PREPARATION', '["Interior conditions inspected and documented prior to work","Under-deck conduit and junction boxes located and marked on roof surface","Existing TPO membrane removed (seam fasteners sliced, screws left covered)","All flashings, fasteners, and accessories removed down to substrates","Debris removed from roof by end of each work shift","Damaged/wet insulation identified and replaced with polyiso infill","Rust-inhibiting primer applied to surface-rusted metal panels where applicable","Existing metal coping removed","Parapet wall TPO flashing cut at base transition","HVAC curb heights confirmed sufficient (min. 8\")","Existing conduit and gas piping temporarily supported or reconfigured","Abandoned curbs capped and flashings removed","Satellite dishes and rooftop cables moved and protected"]'::jsonb, 2),
  ('a1000000-0000-0000-0000-000000000001', 'WOOD BLOCKING', '["2x6 blocking installed at gutter edges between standing seams, flush with seam tops","Continuous solid nailer installed along roof edge, flush with new cover board","Rake edge blocking installed (4\" wide on pan, 2x on top matching polyiso height)","Parapet wall blocking installed on top of horizontal steel purlin","Non-pressure-treated wood used at all metal contact locations","Stainless or hot-dipped galvanized fasteners used where pressure-treated wood present"]'::jsonb, 3),
  ('a1000000-0000-0000-0000-000000000001', 'NEW ROOF ASSEMBLY', '["1/2\" HD polyisocyanurate cover board installed over entire field","Cover board fastened at 6 fasteners per 4x8 board with galvalume flat-bottom plates","Induction weld plates installed into existing steel purlins per zone fastening schedule","Zone 1/1 field fastening: 18\" o.c. along all joists","Zone 2/3 perimeter fastening: 12\" o.c., 15ft from all edges","60-mil TPO membrane installed, induction-welded to plates","Seams heat-welded with 1.5\" weld on outside lap","Seams probed daily and initialed by technician","Cut edge sealant applied to all welded areas without factory edge","T-joint patches installed at all T-joint intersections","Tapered polyiso crickets installed on upslope side of curbs >36\" wide"]'::jsonb, 4),
  ('a1000000-0000-0000-0000-000000000001', 'FLASHINGS & PENETRATIONS', '["Parapet walls flashed with fully adhered 60-mil TPO for full height","Pre-manufactured or shop-fabricated metal coping installed","Gutter edge and rake edge fascia assemblies installed per SRC details","All HVAC curbs flashed with fully adhered TPO, hot-air welded to field membrane","Non-curbed metal ducts flashed per Existing Non-Curbed Metal Ducts detail","Plumbing vent pipes flashed with pre-molded pipe boots, storm collars installed","Round metal flue pipes flashed with TPO-clad metal roofjacks","Pourable sealer pockets installed at conduit/gas pipe penetrations","Gooseneck multi-penetration flashing installed where 3+ conduits cluster","Gas piping painted with rust-inhibiting primer and safety yellow enamel","All abandoned penetrations and conduit removed and terminated below roof level","Fluid-applied reinforced flashing used at all required conditions"]'::jsonb, 5),
  ('a1000000-0000-0000-0000-000000000001', 'DRAINAGE & MISCELLANEOUS', '["New one-piece Kynar-finished 24-gauge flanged gutter installed","Gutter deck flange set in TPO-compatible sealant/mastic","New 6x6 rectangular downspouts installed at existing locations with 45-degree turn-outs","Concrete splash blocks installed at all downspout discharge locations","TPO walkway pads installed on serviceable sides of all HVAC units","TPO walkway pads installed under all condensate discharge points","All conduit/piping re-installed on new OMG pre-manufactured supports","Satellite dish/antenna re-installed and realigned by service provider","Rooftop cable bundles straightened, bundled with UV ties, set on TPO protection strips"]'::jsonb, 6),
  ('a1000000-0000-0000-0000-000000000001', 'CLOSEOUT & WARRANTY', '["Manufacturer technical rep present at preconstruction, first week, and final inspection","5-year contractor workmanship warranty provided to owner","20-year NDL total system manufacturer warranty obtained and provided to owner","All required engineering documents submitted to AHJ and permits closed","Final punchlist items completed and documented","Daily progress emails sent to owner and SRC throughout project"]'::jsonb, 7)
ON CONFLICT DO NOTHING;

-- 5. Demo visit (submitted)
INSERT INTO cm_visits (
  id, cm_project_id, visit_number, visit_date, status, submitted_at
)
VALUES (
  'd1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  1,
  '2026-03-04',
  'submitted',
  '2026-03-04T14:00:00Z'
)
ON CONFLICT (id) DO NOTHING;