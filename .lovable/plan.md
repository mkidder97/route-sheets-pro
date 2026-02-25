

# Building Detail Page

## Overview

Create `/buildings/:id` detail page with tabbed layout showing all building information, add route to App.tsx, and link property names in Buildings.tsx.

## Files to Create

### `src/pages/BuildingDetail.tsx`

New page component with:

**Data fetching:**
- `useParams()` to get `id`
- Query: `supabase.from("buildings").select("*, clients(name), regions(name), inspectors(name)").eq("id", id).maybeSingle()`
- Inspection history: `supabase.from("campaign_buildings").select("*, inspection_campaigns(name, inspection_type), inspectors(name)").eq("building_id", id).order("created_at", { ascending: false })`
- "Building not found" state if null result

**Role gating:**
```typescript
const { role } = useAuth();
const canWrite = role === "admin" || role === "office_manager";
```

**Header (always visible):**
- Back button (ArrowLeft) linking to `/buildings`
- `property_name` as h1
- Address line in muted text
- Client/Region name badges (when present)
- Yellow "Priority" badge when `is_priority === true`
- Edit button (Pencil icon, `canWrite` only) opens Dialog with fields: property_name, address, city, state, zip_code, building_code, roof_group, square_footage, install_year, roof_system, manufacturer, is_priority (Switch)

**Tab 1 -- Overview:**
- Key facts grid: Building Code, Roof Group, Square Footage, Install Year, Roof System, Manufacturer, Inspector
- Roof Access section: roof_access_type, roof_access_description, access_location, lock_gate_codes
- Flags: requires_advance_notice / requires_escort as icon + label
- Special equipment list, special notes block
- Map section: if lat/lng exist, "Open in Google Maps" button (`https://www.google.com/maps?q=${lat},${lng}`). If missing, "Geocode Address" button calling Google Maps Geocoding API directly (NOT `geocodeBuildingsBatch`)

**Tab 2 -- Contacts:**
- Property Manager card (name, phone, mobile, email)
- Asset Manager card (name, phone, email)
- Site Contact card (name, office phone, mobile, email)
- Each card only renders if at least one field is non-null
- Empty state if all groups are null

**Tab 3 -- Inspection History:**
- Table: Campaign Name (link to `/inspections/campaigns/:campaign_id`), Inspection Type, Status (Badge), Inspector, Completion Date
- Empty state if no rows

**Tab 4 -- Notes:**
- Two Textarea fields for `special_notes` and `inspector_notes`
- Save button per field (`canWrite` only)

**Tabs 5 & 6 -- Stubs:**
- "Warranties" and "Documents" as "Coming Soon" placeholders

## Files to Modify

### `src/App.tsx`
- Add lazy import: `const BuildingDetail = lazy(() => import("./pages/BuildingDetail"));`
- Add route inside UnifiedLayout group: `<Route path="/buildings/:id" element={<BuildingDetail />} />`

### `src/pages/Buildings.tsx`
- Import `Link` from `react-router-dom`
- Find the `<span className="font-medium">{b.property_name}</span>` inside the TableCell and replace it with:
  `<Link to={/buildings/${b.id}} className="font-medium hover:underline text-primary">{b.property_name}</Link>`
- This is located by searching for the content `b.property_name` in the TableCell render -- no line number assumed

## No Database Changes
All tables and columns already exist. No migrations needed.

