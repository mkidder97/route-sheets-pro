

## Harden SheetJS Column Parsing in `src/pages/admin/Data.tsx`

**Issue:** The file `src/pages/admin/Data.tsx` does not exist yet — it was planned but never implemented. This plan will **create the file from scratch** with the hardened parsing built in, following the previously approved spec plus these parsing improvements.

### What gets built (single file: `src/pages/admin/Data.tsx`)

The full AdminData page as previously approved (three-state import tool, SheetJS parsing, Supabase matching/updating), but with the parsing layer hardened as follows:

**Normalized header map** — after reading the worksheet, build a lookup:
```ts
const rawHeaders = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[];
const headerMap: Record<string, string> = {};
rawHeaders.forEach((h) => {
  if (typeof h === "string") headerMap[h.trim().toLowerCase()] = h;
});
const col = (key: string) => headerMap[key.trim().toLowerCase()] ?? "";
```

All column accesses use `col(...)` instead of exact string keys:
- `row[col("property code")]` → match key
- `row[col("site contact")]` → `property_manager_name`
- `row[col("site contact email")]` → `property_manager_email`
- `row[col("site contact office phone")]` → `property_manager_phone`

**Missing column warning** — in State 2 (Preview), before the summary card, check if any of the four `col()` lookups returned `""`. If so, render a yellow warning banner (`bg-yellow-500/15 border border-yellow-500/30 text-yellow-200 rounded-lg p-3`) listing which columns were not detected.

### Routing update in `src/App.tsx`

- Add lazy import for `AdminData`
- Swap `/admin/data` route element from `<DataManager />` to `<AdminData />`
- Keep `DataManager` import intact

### Files
- **New:** `src/pages/admin/Data.tsx`
- **Modified:** `src/App.tsx` (2 lines)

