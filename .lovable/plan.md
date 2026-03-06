

## Add "Insert as New Buildings" for Unmatched Rows

Single file change: `src/pages/admin/Data.tsx`

### 1. Extend `UnmatchedRow` interface
Add `propertyName`, `state`, `zip`, `roofAccess`, `roofArea` fields (all strings).

### 2. Populate new fields during parsing
In the primary unmatched loop and the address-fallback "stillUnmatched" path, read from `col("property name")`, `col("state")`, `col("zip")`, `col("roof access")`, `col("roof area")` and include in the unmatched row objects.

### 3. Add state for insert results
Two new state vars: `insertedCount` and `insertFailedCount` (both `number | null`, default `null`). Plus `inserting` boolean for loading state.

### 4. Add `mapRoofAccess` helper and `handleInsertNew` function

```ts
const mapRoofAccess = (val: string): string | null => {
  const v = val.toLowerCase();
  if (v.includes("hatch")) return "roof_hatch";
  if (v.includes("exterior") || v.includes("ext")) return "exterior_ladder";
  if (v.includes("interior") || v.includes("int")) return "interior_ladder";
  if (v.includes("ground")) return "ground_level";
  if (v.trim().length > 0) return "other";
  return null;
};
```

`handleInsertNew`:
- Batch unmatched rows into groups of 50
- For each row, build insert payload with hardcoded `client_id` and `region_id`, mapped fields, `inspection_status: "pending"`
- `roof_access_type`: use `mapRoofAccess(row.roofAccess)`, omit field if null
- `square_footage`: `parseFloat(row.roofArea)` if parseable, else null
- Skip rows missing `property_name` (required column)
- `Promise.all` per batch, count successes/failures
- Set `insertedCount` and `insertFailedCount`

### 5. Add UI below unmatched table
- "Insert {N} as New Buildings" button (variant outline), disabled while inserting
- Inline result text when `insertedCount !== null`: checkmark for inserted, warning for failed

### Files
- **Modified:** `src/pages/admin/Data.tsx`

