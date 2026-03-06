

## Add `matchMethod` field and conditional `building_code` update

### Changes (single file: `src/pages/admin/Data.tsx`)

**1. Extend `MatchedRow` interface** — add `matchMethod: "code" | "address"`.

**2. Set `matchMethod` during parsing:**
- Primary code-match loop: `matchMethod: "code"`
- Address fallback rescue loop: `matchMethod: "address"`

**3. Update import logic** — in `handleImport`, when building the update payload:
- For all rows: include `property_manager_name`, `property_manager_email`, `property_manager_phone` if non-empty (unchanged)
- For `matchMethod === "address"` rows only: also include `building_code: row.propertyCode` if `row.propertyCode` is non-empty

This means address-rescued buildings that had no `building_code` in RoofMind will get backfilled with the Roof Controller property code, preventing them from being "unmatched" on the next import.

### Files
- **Modified:** `src/pages/admin/Data.tsx`

