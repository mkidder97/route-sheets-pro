

# FieldTodayView — Refinements Before Implementation

## Overview
Three refinements to the previously approved FieldTodayView plan, incorporating the user's feedback. No new files or schema changes — just amendments to the implementation approach.

## 1. Campaign Discovery: Single Query (replaces N+1 loop)

Replace the loop-based campaign discovery with a single query:

```ts
const { data } = await supabase
  .from("campaign_buildings")
  .select("campaign_id, inspection_campaigns!inner(id, name, status)")
  .eq("inspection_campaigns.status", "active")
  .eq("inspector_id", inspectorId)
  .limit(1);
```

If localStorage has a cached `roofroute_active_campaign`, try that first. If it returns no rows (campaign closed or inspector reassigned), fall back to the single-query discovery above.

## 2. Dual-Write: Sync buildings table on every status change

After every `campaign_buildings` status update, also update the corresponding `buildings` row to keep SavedRoutes and other office views in sync.

Every status change handler will include both writes:

```ts
// 1. Update campaign_buildings (source of truth for campaign work)
await supabase.from("campaign_buildings").update({
  inspection_status: status,
  completion_date: status === "complete" ? new Date().toISOString() : null,
  inspector_notes: notes || undefined,
}).eq("id", campaignBuildingId);

// 2. Sync buildings table (keeps SavedRoutes consistent)
await supabase.from("buildings").update({
  inspection_status: status,
  completion_date: status === "complete" ? new Date().toISOString() : null,
}).eq("id", buildingId);
```

This applies to all three actions (Done, Skip, Revisit) and to bulk mode. The `buildingId` is available from the joined `buildings(*)` data already loaded in memory.

## 3. No inspector filter on initial load (acknowledged)

The initial load query fetches ALL campaign_buildings for the campaign (no inspector_id filter). This is intentional for now -- it means the field view shows the full campaign. A future prompt can add inspector filtering if needed. Between deployment of this feature and any future filtering update, all buildings in the campaign will be visible, which is acceptable for the current single-active-user scenario.

## Everything else unchanged from the approved plan

- FieldTodayView component structure (5 priority tiers, GPS sorting, progress bars)
- Building card layout (codes prominent, quick actions, expandable details)
- Bulk mode with sticky bottom bar
- Navigation helper (iOS/Android detection)
- Session persistence via localStorage
- MyRoutes.tsx swaps SavedRoutes for FieldTodayView
- SavedRoutes.tsx remains untouched
- No database changes needed

