

# Revert Excel to Single Sheet with Day Column

## Problem
The multi-sheet Excel (Summary + 54 Day tabs + All Buildings) is confusing. The inspector opens the file, sees 54 summary rows, and thinks the data is gone. The 267-building list is buried as the last tab.

## Fix
Replace the entire `generateInspectorExcel` function body in `src/lib/excel-generator.ts` with a single-sheet approach:

- **One sheet** named after the inspector (e.g., "Justin Barnette"), falling back to "Schedule" if no name
- All buildings in geographic route order (iterate days in order, buildings within each day in order)
- "Day" column as the first column
- Stop numbers reset per day (1, 2, 3... for Day 1, then 1, 2, 3... for Day 2)
- **No sorting** -- preserve the order from `days[].buildings[]` exactly
- Remove Summary sheet, per-day sheets, and separate All Buildings sheet

## What stays the same
- `buildingRow()` function -- already handles `dayNumber` parameter
- `detailColWidths` and `allBuildingsColWidths` constants -- unchanged
- `spreadsheet-parser.ts` -- the advance notice regex fix stays
- All other files untouched

## Technical Detail

The `generateInspectorExcel` function (lines 81-132) will be replaced with:

```typescript
export function generateInspectorExcel(
  days: DayData[],
  meta: DocumentMetadata
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const allRows = days.flatMap((day, dayIdx) =>
    day.buildings.map((b, i) => buildingRow(b, i + 1, dayIdx + 1))
  );

  const ws = XLSX.utils.json_to_sheet(allRows);
  ws["!cols"] = allBuildingsColWidths;

  const sheetName = meta.inspectorName
    ? meta.inspectorName.substring(0, 31)
    : "Schedule";

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return wb;
}
```

The `format` import from `date-fns` can also be removed since it was only used for the Summary sheet dates.

## Expected Result
- One sheet named "Justin Barnette"
- 267 rows in geographic route order
- Columns: Day, Stop #, Property Name, Address, City, State, Zip, SF, Market/Group, Bldg Code, Priority, Access Type, Access Location, Codes, Needs Escort, 24H Notice, Needs Ladder, Needs CAD/Core, Other Equipment, PM Name, PM Phone, PM Email, Notes

## Files Changed

| File | Change |
|------|--------|
| `src/lib/excel-generator.ts` | Replace function body, remove unused `format` import |
