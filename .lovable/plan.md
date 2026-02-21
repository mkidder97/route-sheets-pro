

# FieldTodayView: Switch from Campaign to Route Plan Data Source

## Overview
Replace all `campaign_buildings` and `inspection_campaigns` references in `FieldTodayView.tsx` with `route_plans` / `route_plan_days` / `route_plan_buildings` / `buildings` queries. The UI, categorization logic, and user experience remain identical -- only the data plumbing changes.

## What Changes

### 1. Type Replacement

Replace the `CampaignBuilding` interface with a `RoutePlanBuilding` interface that reflects the flattened shape from the new queries:

```ts
interface RoutePlanBuilding {
  id: string;           // buildings.id (used for status writes)
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  // ... all other building fields
  inspection_status: string;
  scheduled_week: string | null;
  is_priority: boolean;
  inspector_notes: string | null;
  photo_url: string | null;
  completion_date: string | null;
  // Route plan metadata
  dayId: string;
  dayNumber: number;
  dayDate: string;
  stopOrder: number;
}
```

### 2. Campaign Discovery --> Route Plan Discovery

Replace `discoverCampaign` with `discoverRoutePlan`:

1. Check `localStorage("roofroute_active_plan")` for cached plan ID
2. If cached, verify with `supabase.from("route_plans").select("id, name, clients(name), regions(name)").eq("id", cachedId).eq("inspector_id", inspectorId).single()`
3. If no cache or cache invalid, query: `supabase.from("route_plans").select("id, name, clients(name), regions(name)").eq("inspector_id", inspectorId).order("created_at", { ascending: false }).limit(5)`
4. If exactly one plan found, auto-select it
5. If multiple plans found, store all and show a dropdown picker
6. Persist selected plan ID to `localStorage("roofroute_active_plan")`

### 3. Building Data Query

Replace the single `campaign_buildings` query with two sequential queries:

```ts
// Step 1: Get all days for this route plan
const { data: dayRows } = await supabase
  .from("route_plan_days")
  .select("id, day_number, day_date")
  .eq("route_plan_id", activePlanId)
  .order("day_number");

// Step 2: Get all buildings through the junction table
const dayIds = dayRows.map(d => d.id);
const { data: rpb } = await supabase
  .from("route_plan_buildings")
  .select("route_plan_day_id, stop_order, buildings(*)")
  .in("route_plan_day_id", dayIds)
  .order("stop_order");

// Step 3: Flatten into RoutePlanBuilding[]
const buildings = rpb.map(r => ({
  ...r.buildings,
  dayId: r.route_plan_day_id,
  dayNumber: dayRows.find(d => d.id === r.route_plan_day_id)?.day_number,
  dayDate: dayRows.find(d => d.id === r.route_plan_day_id)?.day_date,
  stopOrder: r.stop_order,
}));
```

### 4. Categorization Logic

The `categorizeBuildng` function stays the same -- it already reads `inspection_status`, `is_priority`, and `scheduled_week`, which are all fields on the `buildings` table.

### 5. Status Updates: Write to `buildings` Only

Remove all `campaign_buildings` writes. Single write to `buildings`:

```ts
await supabase.from("buildings").update({
  inspection_status: status,
  completion_date: status === "complete" ? new Date().toISOString() : null,
  inspector_notes: notes || undefined,
}).eq("id", buildingId);
```

This applies to: Done, Skip, Revisit, and Bulk Complete. No dual-write needed since there's only one source of truth now.

### 6. Bulk Complete

```ts
await supabase.from("buildings").update({
  inspection_status: "complete",
  completion_date: new Date().toISOString(),
}).in("id", Array.from(selectedIds));
```

`selectedIds` now contains `buildings.id` values directly (not `campaign_buildings.id`).

### 7. UI Adjustments

- Header label changes from `campaignName` to `planName` (the route plan's name)
- Empty state message changes from "No active campaign found" to "No route plan found for this inspector"
- If multiple route plans exist, render a `Select` dropdown at the top to pick one
- All building card rendering stays identical (reads from the same building fields)
- `inspector_notes` and `photo_url` now come directly from `buildings` (same field names)

### 8. Session Persistence Key

Change `roofroute_active_campaign` to `roofroute_active_plan` throughout.

## What Does NOT Change

- The 5-tier priority grouping (priority, this_week, retry, overdue, backlog)
- GPS sorting via haversineDistance within each tier
- Building card layout, expanded details, badges
- Bulk mode UI pattern
- Navigation helper (iOS/Android detection)
- GPS refresh button
- Note dialog for Skip/Revisit
- `MyRoutes.tsx` (already renders `FieldTodayView`)
- `SavedRoutes.tsx` (untouched)
- No database schema changes needed

## Files Modified

- `src/components/FieldTodayView.tsx` -- rewrite data layer, keep all UI

