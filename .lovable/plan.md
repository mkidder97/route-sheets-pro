

## Three Targeted Fixes

### Fix 1 — FieldHome.tsx: Remove campaign progress bar and completion counter
**File**: `src/pages/field/FieldHome.tsx`
- Lines 7, 80-88: Remove `Progress` import, remove the `<Progress>` bar block and the completed/total text line
- Keep campaign name and date range only

### Fix 2 — FieldInspections.tsx: Buildings tab with client/region filters + smart search
**File**: `src/pages/field/FieldInspections.tsx`
- Add imports: `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select`
- Remove unused `Progress` import
- Add state: `selectedClient`, `selectedRegion` (both string, default `""`)
- Add `useQuery` for filter options: fetches active clients and regions
- Update buildings query: key includes filter state, enabled when any filter active or search >= 2 chars, applies `.eq("client_id")`, `.eq("region_id")`, `.or("property_name.ilike...,address.ilike...")` conditionally, limit 200
- Replace Buildings tab content: filter row with Client Select, Region Select, Search Input; conditional empty/loading/results states

### Fix 3 — FieldInspections.tsx: History tab with real data
- Add `useQuery` with key `["field-history", profile?.inspector_id]`
- Fetches inspector's region, then campaigns for that region, then completed campaign_buildings with building details
- Maps results to cards showing building name, address, campaign name badge, completion date
- Empty state: History icon + "No completed inspections yet"

### Files touched
- `src/pages/field/FieldHome.tsx` — remove Progress bar and completion text
- `src/pages/field/FieldInspections.tsx` — rebuild Buildings tab filters + History tab query

