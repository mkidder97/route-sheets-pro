

# Campaign Snapshot Model + Multi-Type Inspections

## Overview

Switch campaigns from live-querying the buildings table to a snapshot model using a `campaign_buildings` junction table. Add `inspection_type` support (Annual, Due Diligence, Survey, Storm). Each campaign creation snapshots the current buildings into the junction table for independent per-campaign tracking.

## 1. Database Migration

### A) Add `inspection_type` to `inspection_campaigns`
- New column: `inspection_type text NOT NULL DEFAULT 'annual'`
- CHECK constraint: values must be one of `annual`, `due_diligence`, `survey`, `storm`

### B) Create `campaign_buildings` junction table

| Column | Type | Details |
|--------|------|---------|
| id | uuid | PK, gen_random_uuid() |
| campaign_id | uuid | NOT NULL, FK to inspection_campaigns ON DELETE CASCADE |
| building_id | uuid | NOT NULL, FK to buildings ON DELETE CASCADE |
| inspection_status | text | NOT NULL, default 'pending', CHECK constraint |
| inspector_id | uuid | FK to inspectors |
| scheduled_week | text | Nullable |
| is_priority | boolean | NOT NULL, default false |
| completion_date | date | Nullable |
| inspector_notes | text | Nullable |
| photo_url | text | Nullable |
| created_at | timestamptz | NOT NULL, default now() |

- UNIQUE(campaign_id, building_id) to prevent duplicates
- Indexes on campaign_id, building_id, and inspection_status for query performance

### C) RLS on `campaign_buildings`
- Enable RLS
- Single permissive policy: authenticated users (`auth.uid() IS NOT NULL`) can perform ALL operations

## 2. Update `src/pages/ops/OpsJobBoard.tsx`

### Tab and type changes
- Rename tab from "Annuals" to "Inspections"
- Add `inspection_type` to the Campaign type definition
- Add an Inspection Type filter dropdown in the filter bar (All Types, Annual, Due Diligence, Survey, Storm)
- Wire filter to `fetchCampaigns` query

### New Campaign dialog updates
- Add Inspection Type dropdown as the first field (default: Annual)
- Update description text to "Create a new inspection campaign."
- Add `inspection_type` to form state and insert payload

### Updated `handleCreate` logic
1. Insert campaign with `inspection_type`
2. Fetch all buildings matching `client_id + region_id` (select `id, is_priority`)
3. Build an array of `campaign_buildings` rows from the results
4. Bulk insert into `campaign_buildings` -- if more than 500 rows, chunk into batches of 500 to avoid timeout/truncation issues with the Supabase client
5. Set `total_buildings` to the count of inserted rows, `completed_buildings` to 0
6. Error handling: if the bulk insert fails, show a warning toast but still keep the campaign (it can be re-synced later)

### Campaign card updates
- Add a type badge below the status badge on each card
- Color scheme: annual = blue outline, due_diligence = purple outline, survey = teal outline, storm = red outline
- Use Badge variant="outline" with className for colored text/border

## 3. Update `src/pages/ops/OpsCampaignDetail.tsx`

### Type and header updates
- Add `inspection_type` to Campaign type
- Show type badge in header next to the status (same color scheme as cards)

### Replace buildings query
Current query fetches from `buildings` table directly. Replace with:

```text
supabase.from("campaign_buildings").select(`
  id, inspection_status, inspector_id, scheduled_week,
  is_priority, completion_date, inspector_notes, photo_url,
  building:buildings (
    id, stop_number, property_name, address, city, state, zip_code,
    building_code, roof_group, square_footage,
    roof_access_type, roof_access_description, access_location, lock_gate_codes,
    property_manager_name, property_manager_phone, property_manager_email,
    special_notes, special_equipment, requires_advance_notice, requires_escort
  ),
  inspector:inspectors ( name )
`).eq("campaign_id", id).order("created_at")
```

### Update Building type
- Top-level fields: `id`, `inspection_status`, `inspector_id`, `scheduled_week`, `is_priority`, `completion_date`, `inspector_notes`, `photo_url`, `inspector`
- Nested `building` object: all master building fields (property_name, address, city, state, etc.)

### Update all JSX references
- `b.property_name` becomes `b.building.property_name`
- `b.address` becomes `b.building.address`
- `b.city` becomes `b.building.city`
- `b.inspectors?.name` becomes `b.inspector?.name`
- `b.requires_advance_notice` becomes `b.building.requires_advance_notice`
- `b.requires_escort` becomes `b.building.requires_escort`
- Campaign-level fields (`inspection_status`, `is_priority`, `inspector_notes`, `completion_date`, `photo_url`) stay at top level

### Update filter and sort logic
- Search references `b.building.property_name` and `b.building.address`
- Sort: building-level keys (stop_number, property_name, city) access via `item.building[key]`; campaign-level keys (inspection_status, scheduled_week) access directly

### Update BuildingDetail component
- Building-level fields (address, codes, roof access, PM info, equipment): access via `b.building.*`
- Campaign-level fields (inspector_notes, completion_date, photo_url): access via `b.*`

## Files

| File | Action |
|------|--------|
| New migration SQL | Add inspection_type column + create campaign_buildings table with RLS |
| `src/pages/ops/OpsJobBoard.tsx` | Add type filter, type in dialog, snapshot creation with chunked bulk insert, type badge on cards |
| `src/pages/ops/OpsCampaignDetail.tsx` | Switch to campaign_buildings query, update types, all JSX references, filters, sort |

## Technical Details

| Item | Detail |
|------|--------|
| Bulk insert safety | Chunk into batches of 500 to prevent timeout on large building sets |
| Error resilience | Campaign is kept even if bulk insert partially fails; user sees warning |
| No changes to | App.tsx (route already exists) |
| Junction table | campaign_buildings with per-campaign status snapshot |
| Inspection types | annual, due_diligence, survey, storm |
| RLS | Permissive ALL for authenticated users on campaign_buildings |

