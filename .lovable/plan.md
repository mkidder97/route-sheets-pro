

# Auto-Sync on View + Export Button

## Overview

Add two features to the Campaign Detail page:
1. Silently sync campaign totals when buildings finish loading, with auto-complete detection
2. Export button to download all buildings as an Excel file

---

## 1. Auto-Sync on View

### Implementation
- Add a `useRef` (`syncedRef`) to track whether sync has already run for the current campaign
- Add a `useEffect` that fires when `buildings` array is populated and `campaign` is loaded
- Reset `syncedRef` when `campaign.id` changes

### Sync logic
1. `total = buildings.length`
2. `completed = buildings.filter(b => b.inspection_status === 'complete').length`
3. If `total !== campaign.total_buildings` or `completed !== campaign.completed_buildings`:
   - Update `inspection_campaigns` row with both counts
   - Update local `campaign` state
4. **Auto-complete**: If `completed === total && total > 0 && campaign.status !== 'on_hold' && campaign.status !== 'complete'`:
   - Also set campaign `status = 'complete'`
   - Show toast: "Campaign marked complete!"
5. All other corrections are silent (no toast)

---

## 2. Export Button

### Placement
- In the header area, inside the `flex items-center gap-2` div (line 527), after the type badge and before/next to the status control
- `Button variant="outline" size="sm"` with `Download` icon from lucide-react

### Excel generation
- Import `* as XLSX from "xlsx"` at top
- On click, map the full `buildings` array (not filtered) to rows with 26 columns:
  - Stop #, Property Name, Address, City, State, Zip, Status, Inspector, Scheduled Week, Building Code, Roof Group, Sq Footage, Access Type, Access Description, Access Location, Lock/Gate Codes, Property Manager, PM Phone, PM Email, Priority, 24H Notice, Escort Required, Special Equipment, Special Notes, Inspector Notes, Completion Date
- Create workbook via `XLSX.utils.json_to_sheet` + `book_new` + `book_append_sheet` + `writeFile`
- Filename: `${campaign.name} - Export - ${format(new Date(), "yyyy-MM-dd")}.xlsx`

---

## Changes to `src/pages/ops/OpsCampaignDetail.tsx`

1. **New imports**: `useRef` (from React), `Download` (from lucide-react), `* as XLSX from "xlsx"`
2. **New ref**: `const syncedRef = useRef(false)` -- reset to false when `campaign?.id` changes
3. **New useEffect**: auto-sync logic (fires when `buildings.length > 0 && campaign`)
4. **New function**: `handleExport()` -- builds XLSX and triggers download
5. **New button**: Export button in header area

---

## Files

| File | Action |
|------|--------|
| `src/pages/ops/OpsCampaignDetail.tsx` | Add useRef, auto-sync useEffect, export function, export button |

## Technical Details

| Item | Detail |
|------|--------|
| Sync guard | `useRef` boolean prevents re-running on every render |
| Auto-complete condition | completed === total, total > 0, status not on_hold or complete |
| Export source | Full `buildings` array, not the filtered subset |
| XLSX library | Already installed (v0.18.5), already used in `src/lib/excel-generator.ts` |
| No database migration needed | All tables already exist |

