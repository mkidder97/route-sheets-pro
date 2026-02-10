
# Export Buttons, Remove Field View, Auto-Advance

## File: `src/components/SavedRoutes.tsx`

### Change 1 -- Update imports

- Remove `Smartphone` from lucide-react (no longer used after Field View removal)
- Add `FileText`, `FileSpreadsheet` from lucide-react
- Add imports for `generateInspectorPDF`, `DayData`, `BuildingData`, `DocumentMetadata` from `@/lib/pdf-generator`
- Add import for `generateInspectorExcel` from `@/lib/excel-generator`
- Add `import * as XLSX from "xlsx"`

### Change 2 -- Remove `navigate` prop

- Change component signature from `function SavedRoutes({ navigate }: { navigate: (path: string) => void })` to `function SavedRoutes()`

### Change 3 -- Add `exporting` state + `handleExport` function

- Add `const [exporting, setExporting] = useState(false)` alongside existing state
- Add `handleExport(plan, format)` function that:
  - Loads route_plan_days and route_plan_buildings with buildings join
  - Maps data into `DayData[]` and `DocumentMetadata`
  - Calls `generateInspectorPDF` or `generateInspectorExcel` + `XLSX.writeFile`
  - Shows success/error toasts

### Change 4 -- Auto-advance after marking complete

- In `updateStatus`, after the `setDays` call that updates the status (line ~220-229), add logic:
  - If `status === "complete"`, use `setTimeout` with a read-only `setDays` call to find the next non-complete building after the current one in the selected day, and call `setExpandedBuilding(nextPending.id)` or `setExpandedBuilding(null)` if none remain

### Change 5 -- Replace bottom action bar (lines 574-581)

Remove the Field View button and add PDF/Excel export buttons:
- "Export PDF" button with `FileText` icon, calls `handleExport(plan, "pdf")`
- "Export Excel" button with `FileSpreadsheet` icon, calls `handleExport(plan, "excel")`
- Keep existing "Delete" button unchanged
- Both export buttons show a `Loader2` spinner when `exporting` is true

## File: `src/pages/RouteBuilder.tsx`

### Change 6 -- Remove navigate prop from SavedRoutes usage

- Change `<SavedRoutes navigate={navigate} />` to `<SavedRoutes />`
- Keep `useNavigate` import (still used by the generation wizard)

## What does NOT change

- Day picker chips, day summary bar, building cards, note dialog, delete dialog -- all untouched
- Status tap buttons (Done/Skip/Revisit) -- untouched
- Navigate button -- untouched
- pdf-generator.ts and excel-generator.ts -- untouched
