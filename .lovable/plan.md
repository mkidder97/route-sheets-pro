

## Add Unmatched Rows View to Preview State

### Changes (single file: `src/pages/admin/Data.tsx`)

**1. New state and data:**
- Add `unmatchedRows` state: `{ propertyCode: string; siteContact: string; email: string }[]`
- Add `showSkipped` boolean state (default `false`)
- Both reset in `reset()`

**2. Collect unmatched rows during parsing:**
In the existing loop (line ~106-125), when a row doesn't match (`!building`), push it to the `unmatchedRows` array with its property code, site contact, and email extracted from the row.

**3. Add collapsible section in Preview UI:**
After the matched rows table (after line 262), before the action buttons:
- Toggle button: `text-xs text-slate-400 underline` ghost style, reads `"Show {N} unmatched rows ▾"` / `"Hide unmatched rows ▴"`
- When expanded: scrollable table (`max-h-48 overflow-y-auto`) with columns: Property Code, Site Contact, Email, Reason
- Reason column always reads `"No matching building_code in RoofMind"`
- Only rendered when `unmatchedRows.length > 0`

No changes to import logic, routing, or other states.

