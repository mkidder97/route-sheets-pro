

# Add Findings Tab to BuildingDetail

## Summary
Create a new `FindingsTab` component and integrate it into `BuildingDetail.tsx`. Rename the existing "History" tab to "Campaign History" and reorder tabs as specified.

## Changes

### 1. New file: `src/components/building/FindingsTab.tsx`

A self-contained component receiving `buildingId`, `canWrite` props.

**State:**
- `findings` -- fetched from `inspection_findings` with joined inspector name, ordered by `inspection_date desc`
- `selectedFindingId` -- UUID of currently selected finding
- `inspectors` -- list for dropdown
- `campaigns` -- list of campaigns linked to this building (via `campaign_buildings`)
- `editMode` -- boolean for narrative editing
- `addMode` -- boolean for new finding form
- `saving` -- loading state
- Form data for edit and add modes

**Data fetching:**
- `loadFindings()`: `supabase.from('inspection_findings').select('*, inspectors(name)').eq('building_id', buildingId).order('inspection_date', { ascending: false })` -- auto-selects first finding
- `loadInspectors()`: `supabase.from('inspectors').select('id, name').order('name')`
- `loadCampaigns()`: `supabase.from('campaign_buildings').select('campaign_id, inspection_campaigns(id, name)').eq('building_id', buildingId)` -- deduplicate campaign list

**Layout:**
```text
+------------------+-------------------------------------+
| Date sidebar     | Content panel                       |
| (w-40)           | (flex-1)                            |
|                  |                                     |
| [2026-02-15] *   | [amber banner if in_progress]       |
| [2026-01-10]     |                                     |
|                  | Narrative text (or textarea in edit) |
|                  |                                     |
| [+ Add Finding]  | Inspector: John Doe                 |
|                  | Campaign: Spring 2026  [pencil]     |
+------------------+-------------------------------------+
```

**Date sidebar:**
- Each date as a button with full width, text-sm, rounded-md
- Selected: `bg-primary text-white`; unselected: `text-slate-400 hover:bg-slate-700`
- Amber dot (w-2 h-2 rounded-full bg-amber-400) before date if `is_in_progress`
- Format dates with `date-fns` `format(parseISO(d), 'MMM d, yyyy')`
- "+ Add Finding" button at bottom (canWrite only, Plus icon)

**Right panel -- view mode:**
- Amber banner if `is_in_progress`: `bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4`, AlertTriangle icon, text-amber-400
- Narrative: `text-sm text-slate-300 whitespace-pre-wrap leading-relaxed`
- Meta row: `text-xs text-slate-500 flex gap-4 mt-4` -- inspector name, campaign link
- Pencil edit button (canWrite): top-right, opens edit mode

**Right panel -- edit mode:**
- Textarea for narrative: `min-h-[300px] font-mono text-sm bg-slate-900 border-slate-600`
- `is_in_progress` Switch
- `inspector_id` Select dropdown from inspectors list
- `campaign_id` Select dropdown from campaigns list
- Save: UPDATE inspection_findings SET narrative, is_in_progress, inspector_id, campaign_id, updated_at
- Cancel: revert to view mode

**Add Finding form (replaces right panel):**
- `inspection_date`: Input type="date", required, default today
- `is_in_progress`: Switch
- `inspector_id`: Select (optional)
- `campaign_id`: Select (optional)
- `narrative`: Textarea min-h-[200px] font-mono
- Save: INSERT into inspection_findings, re-fetch, select new finding
- Cancel: return to list view

**Empty state:** FileText icon (w-12 opacity-20), "No inspection findings yet", "Add First Finding" button (canWrite)

### 2. Modify `src/pages/BuildingDetail.tsx`

Minimal changes only:

- **Import** `FindingsTab` from `@/components/building/FindingsTab`
- **Tab order** (lines 265-272): Reorder TabsTrigger elements:
  - Overview | Contacts | Roof Specs | Findings | Campaign History | Notes | Documents
  - Rename `value="history"` to `value="campaign-history"`, label "Campaign History"
  - Add `value="findings"` trigger with label "Findings"
- **TabsContent**: 
  - Rename `value="history"` to `value="campaign-history"` (keep all existing history content unchanged)
  - Add new `<TabsContent value="findings"><FindingsTab buildingId={building.id} canWrite={canWrite} /></TabsContent>`
  - Move Roof Specs before Findings in render order to match tab order

No other tabs, routes, or data fetches are changed.

### 3. Styling
- All per dark design system: `bg-slate-800 border-slate-700/50` for cards
- Lucide icons only, no emojis
- Timeline feel via the date sidebar

