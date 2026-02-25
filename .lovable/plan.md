
# Split Inspection Campaigns from CM Jobs

## Summary

Extract inspection campaigns UI from `OpsJobBoard.tsx` into `inspections/Campaigns.tsx`, simplify `OpsJobBoard.tsx` to only show CM Jobs, update the campaign detail back button, and add the new campaign detail route.

## Changes

### 1. Replace `src/pages/inspections/Campaigns.tsx`

Rewrite the placeholder with the full campaigns list extracted from `OpsJobBoard.tsx`:
- All types (`Campaign`, `Client`, `Region`), constants (`STATUS_OPTIONS`, `STATUS_COLORS`, `INSPECTION_TYPE_OPTIONS`, `TYPE_BADGE_COLORS`)
- All state: clients, regions, campaigns, loading, filter state (filterClient, filterRegion, filterStatus, filterType), dialog state (dialogOpen, saving, nameManuallyEdited, form)
- All computed values: `filteredRegions`, `dialogRegions`
- All effects: fetchClients, fetchRegions, fetchCampaigns, auto-fill name, reset region on client change
- All handlers: `handleCreate`, `resetDialog`, `progressPercent`
- Full UI: title "Inspection Campaigns", "New Campaign" button (canWrite only), filter dropdowns, campaign card grid, New Campaign dialog
- One key difference: campaign card `onClick` navigates to `/inspections/campaigns/${c.id}` instead of `/ops/jobs/campaign/${c.id}`
- No Tabs wrapper -- just the campaigns content directly

### 2. Simplify `src/pages/ops/OpsJobBoard.tsx`

Strip down to ~20 lines:
- Keep imports for `CMJobsBoard` only
- Remove all campaign state, effects, handlers, constants, types
- Remove Tabs, Dialog, filter controls
- Render: heading "CM Jobs" + `<CMJobsBoard />`

### 3. Update `src/pages/ops/OpsCampaignDetail.tsx` (line 598-599)

Change:
```tsx
<Button variant="ghost" size="sm" onClick={() => navigate("/ops/jobs")}>
  <ArrowLeft className="h-4 w-4 mr-1" /> Back to Job Board
</Button>
```
To:
```tsx
<Button variant="ghost" size="sm" onClick={() => navigate("/inspections/campaigns")}>
  <ArrowLeft className="h-4 w-4 mr-1" /> Back to Campaigns
</Button>
```

### 4. Update `src/App.tsx` (after line 77)

Add one route for the new campaign detail path:
```tsx
<Route path="/inspections/campaigns/:id" element={<OpsCampaignDetail />} />
```
Keep the existing `/ops/jobs/campaign/:id` route for backward compatibility.

### 5. No changes to UnifiedLayout.tsx

Nav already has Campaigns under Inspections and CM Jobs under Operations -- both point to the correct routes.

## What does NOT change

- `CMJobsBoard` component -- untouched
- `OpsCampaignDetail` data fetching/UI -- only the back button text and path
- Database queries and table names -- identical
- `UnifiedLayout.tsx` nav structure
- Supabase types
