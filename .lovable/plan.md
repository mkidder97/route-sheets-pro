

# Fix Schedule Upload + Add Schedule Management Features

This is a three-file change. ScheduleUpload fix is highest priority. If implementation struggles, Features 3 and 4 (FieldTodayView changes) can be split out.

---

## File 1: `src/components/ScheduleUpload.tsx` (Priority: HIGHEST)

### A. Replace campaign data source with route plan data source

**Type rename**: `CampaignBuilding` becomes `PlanBuilding`. Add `scheduled_week: string | null` field for re-upload detection.

**State rename**: `campaignId` becomes `routePlanId` throughout. `STEPS[0]` becomes `"File & Route Plan"`.

**Campaign query (lines 102-113)** -- replace with route_plans query:
```ts
const { data: routePlans = [] } = useQuery({
  queryKey: ["schedule-upload-plans"],
  enabled: open,
  queryFn: async () => {
    const { data } = await supabase
      .from("route_plans")
      .select("id, name, clients(name), regions(name), inspector_id, inspectors(name)")
      .order("created_at", { ascending: false });
    return (data ?? []) as any[];
  },
});
```

**Campaign buildings query (lines 115-132)** -- replace with route_plan_buildings query:
```ts
const { data: planBuildings = [], isLoading: buildingsLoading } = useQuery({
  queryKey: ["schedule-upload-buildings", routePlanId],
  enabled: !!routePlanId,
  queryFn: async () => {
    const { data: days } = await supabase
      .from("route_plan_days").select("id").eq("route_plan_id", routePlanId);
    if (!days || days.length === 0) return [];
    const dayIds = days.map(d => d.id);
    const { data: rpb } = await supabase
      .from("route_plan_buildings")
      .select("building_id, buildings!inner(id, building_code, property_name, address, city, scheduled_week)")
      .in("route_plan_day_id", dayIds);
    const seen = new Set<string>();
    return (rpb ?? []).filter((r: any) => {
      if (seen.has(r.building_id)) return false;
      seen.add(r.building_id); return true;
    }).map((r: any) => ({
      id: r.buildings.id,
      building_id: r.buildings.id,
      building_code: r.buildings.building_code,
      property_name: r.buildings.property_name,
      address: r.buildings.address,
      city: r.buildings.city,
      scheduled_week: r.buildings.scheduled_week,
    }));
  },
});
```

**Matching logic (lines 183-240)**: Replace `campaignBuildings` with `planBuildings`. Remove `matchedCbId` from `MatchedRow` interface entirely -- only `matchedBuildingId` is needed.

**Manual fix handler (lines 244-258)**: Look up by `planBuildings.find(b => b.id === buildingId)` instead of `campaignBuildings.find(c => c.id === cbId)`.

**handleApply (lines 284-323)**: Write to `buildings` table instead of `campaign_buildings`:
```ts
const toUpdate = matchedRows.filter(r => r.matchedBuildingId && r.scheduledWeek);
for (const row of toUpdate) {
  if (skipScheduled && planBuildings.find(b => b.id === row.matchedBuildingId)?.scheduled_week) {
    skipped++; continue;
  }
  await supabase.from("buildings").update({
    scheduled_week: row.scheduledWeek,
    is_priority: row.isPriority,
    ...(row.inspectorId ? { inspector_id: row.inspectorId } : {}),
  }).eq("id", row.matchedBuildingId!);
}
```

**Query invalidation (line 320)**: Change `schedule-upload-cb` to `schedule-upload-buildings`.

**Step 0 UI (lines 354-389)**: Change "Campaign" label to "Route Plan". Render `routePlans` with `{plan.name} -- {client} / {region}` format.

**Step 2 manual fix dropdown (lines 546-561)**: Replace `campaignBuildings.map(cb => ...)` with `planBuildings.map(b => ...)`, using `b.id` as value.

**Reset handler (line 329)**: `setRoutePlanId("")` instead of `setCampaignId("")`. Add `setSkipScheduled(false)`.

### B. Re-upload handling (Feature 2)

Add state: `const [skipScheduled, setSkipScheduled] = useState(false);`

At top of Step 2 preview, add checkbox:
```tsx
<label className="flex items-center gap-2 text-sm">
  <Checkbox checked={skipScheduled} onCheckedChange={v => setSkipScheduled(!!v)} />
  Only update unscheduled buildings (skip rows where a week is already set)
</label>
```

In the Week column of the match table (line 564), add an overwrite badge when the matched building already has a different `scheduled_week`:
```tsx
{row.scheduledWeek || "---"}
{row.matchedBuildingId && (() => {
  const existing = planBuildings.find(b => b.id === row.matchedBuildingId)?.scheduled_week;
  if (existing && existing !== row.scheduledWeek) {
    return (
      <Badge className="ml-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[9px]">
        Overwrites: Week of {format(parseISO(existing), "MMM d")}
      </Badge>
    );
  }
  return null;
})()}
```

**Note on formatting**: `format(parseISO(existing), "MMM d")` produces "Feb 9" (not the raw ISO "2026-02-09"). Import `parseISO` from date-fns (already used in OpsScheduling but needs adding to ScheduleUpload imports).

In `handleApply`, when `skipScheduled` is true, skip rows where the matched building already has `scheduled_week` set.

---

## File 2: `src/pages/ops/OpsScheduling.tsx`

### Schedule History section (Feature 1)

Add state near line 941:
```ts
const [selectedHistoryPlanId, setSelectedHistoryPlanId] = useState<string>("");
const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
```

Add route plans query for the history selector and a schedule history query that fetches building IDs in the selected plan, then groups by `scheduled_week` client-side (same pattern as in the approved plan).

Add UI after the calendar (before the EventDialog at line 1175):
- Route plan selector dropdown
- List of week cards: "Week of Feb 9, 2026" -- 18 buildings, 6 complete, 4 priority
- Progress bar per card
- Collapsible: click to expand and see buildings for that week

---

## File 3: `src/components/FieldTodayView.tsx`

### Feature 3: Inspector filter

Add `inspector_id: string | null` to the `RoutePlanBuilding` interface (line 51). The `buildings(*)` spread already pulls it, but without the explicit type, TypeScript may flag `b.inspector_id` as not existing on the type.

After flattening buildings (line 270), filter:
```ts
const myBuildings = flattened.filter(b =>
  !b.inspector_id || b.inspector_id === inspectorId
);
setBuildings(myBuildings);
```

### Feature 4: Week navigation

Add state: `const [selectedWeekMonday, setSelectedWeekMonday] = useState<string>(getCurrentWeekMonday());`

Compute available weeks from loaded buildings:
```ts
const availableWeeks = useMemo(() => {
  const weeks = [...new Set(buildings.map(b => b.scheduled_week).filter(Boolean))] as string[];
  return weeks.sort();
}, [buildings]);
```

Add prev/next navigation functions that cycle through `availableWeeks`.

Update `categorizeBuilding` calls and progress calculations to use `selectedWeekMonday` instead of `currentWeekMonday`.

Add week selector UI below the progress bar (before bulk toggle, around line 535):
```tsx
{availableWeeks.length > 0 && (
  <div className="flex items-center justify-center gap-2">
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevWeek}
      disabled={availableWeeks.indexOf(selectedWeekMonday) <= 0}>
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <span className="text-xs font-medium">
      Week of {format(parseISO(selectedWeekMonday), "MMM d, yyyy")}
    </span>
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextWeek}
      disabled={availableWeeks.indexOf(selectedWeekMonday) >= availableWeeks.length - 1}>
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
)}
```

Add imports: `ChevronLeft`, `ChevronRight` from lucide-react; `parseISO` from date-fns.

If no buildings have `scheduled_week` set, the week selector is hidden and all buildings appear in Backlog.

---

## Key Details to Get Right

1. **`inspector_id` in RoutePlanBuilding interface**: Must explicitly add `inspector_id: string | null` to the interface (line 51 area). Without this, the filter `b.inspector_id === inspectorId` will fail silently in strict TypeScript.

2. **Overwrite badge formatting**: Use `format(parseISO(existing), "MMM d")` to display "Feb 9" instead of raw "2026-02-09". Requires adding `parseISO` to ScheduleUpload imports from date-fns.

3. **No database changes needed** -- all queries use existing tables and columns. RLS policies already permit these operations.

## What Does NOT Change

- SavedRoutes.tsx -- untouched
- Database schema -- no new tables or columns
- Calendar/event management in OpsScheduling -- untouched
- Building card layout in FieldTodayView -- untouched
- Navigation helper, bulk mode, note dialog -- untouched

