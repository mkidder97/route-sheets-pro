

# Fix Excel Generator Sort Bug and 24H Notice Detection

## What's Wrong

**Bug 1**: The Excel download sorts buildings alphabetically by city instead of keeping the optimized geographic route order from the clustering engine. This makes the Excel useless as a field guide since it doesn't match the actual driving route.

**Bug 2**: The 24-hour advance notice detection misses common abbreviations like "24 hr notice", "MUST HAVE APPOINTMENT", and "call to schedule" -- so buildings that need advance coordination don't get flagged.

## What Will Change

### File 1: `src/lib/excel-generator.ts` -- Multi-sheet structure, no re-sorting

- **Remove** the alphabetical `.sort()` block (lines 79-87) entirely
- **Restructure** the workbook to create multiple sheets:
  - **"Summary"** sheet: One row per day showing Day #, Date, Building Count, Cities covered, Total SF, has priority buildings, notes about advance notice/escort needs
  - **"Day 1", "Day 2", ...** sheets: Each day's buildings in their geographic route order with stop numbers 1, 2, 3... per day
  - **"All Buildings"** sheet: Every building across all days in route order (Day 1 first, then Day 2, etc.) with a "Day" column prepended; stop numbers reset per day
- Buildings are **never re-sorted** -- the order from `days[].buildings[]` is preserved exactly as the clustering engine produced it

### File 2: `src/lib/spreadsheet-parser.ts` -- Broader advance notice detection

- **Replace** the regex on line 122 with a comprehensive pattern that catches:
  - "24 hr", "24 hr.", "24 hrs", "24-hr" (abbreviations)
  - "appointment", "must have appointment", "set appointment"
  - "call ahead", "call to schedule", "call PM to schedule"
  - "notice required", "schedule in advance", "notify before"
- The existing "24 hour" and "advance notice" patterns continue to work

### Files NOT Changed

- `src/lib/route-clustering.ts` -- clustering algorithm is correct
- `src/lib/geo-utils.ts` -- working fine
- `src/lib/pdf-generator.ts` -- working fine
- `src/pages/Schedules.tsx` -- passes data correctly already

## Technical Details

### Excel Sheet Structure

```text
Workbook
 +-- "Summary" sheet (1 row per day)
 |     Day | Date | Buildings | Cities | Total SF | Priority | Notes
 +-- "Day 1" sheet (buildings in route order, stop 1..N)
 +-- "Day 2" sheet
 +-- ...
 +-- "All Buildings" sheet (all days concatenated, Day column added)
```

### Updated Advance Notice Regex

```text
/24[\s.-]*h(?:ou)?rs?\.?|advance\s*notice|notice\s*(?:is\s*)?required|(?:must\s*(?:have|set|make)\s*)?appointment|schedule\s*(?:in\s*advance|visit|appointment)|call\s*(?:ahead|before|prior|to\s*schedule|pm\s*to\s*schedule)|notify\s*(?:before|prior)/i
```

### Summary Sheet Row Logic

For each day, compute:
- Unique cities from that day's buildings
- Sum of square footage
- Whether any building has `is_priority`
- Count of buildings needing advance notice or escort

### Column Structure

The existing column structure and widths remain unchanged for all building sheets. The "All Buildings" sheet adds one extra "Day" column at the beginning, shifting all other columns right by one.

## After This Change

- Re-uploading the Atlanta spreadsheet will correctly flag "24 hr notice" and "appointment" buildings
- Generating an Excel from Schedules will produce day-grouped sheets in geographic route order
- The PDF and Excel will show matching stop orders per day

