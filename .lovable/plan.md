

# Fix Excel Export: Flat Building List

## The Problem
The Excel export is currently organized around "days" with a Day column, a Summary tab, and per-day tabs. This is wrong. The output should mirror the original uploaded spreadsheet -- a single flat list of every building with all its details, just re-sorted into the optimized route order.

## What Changes

### `src/lib/excel-generator.ts`

1. **Remove** the Summary tab entirely
2. **Remove** the per-day tabs entirely
3. **Remove** the "Day" column from the building row
4. **Keep** a single sheet called "Route Schedule" with one row per building, in route order
5. The columns will be the same building-level fields minus "Day":
   - Stop #, Property Name, Address, City, State, Zip, SF, Market/Group, Bldg Code, Priority, Access Type, Access Location, Codes (Lock/Gate), Needs Escort, 24H Notice, Needs Ladder, Needs CAD/Core, Other Equipment, Notes
6. **Update** column widths array to remove the Day entry

This gives the inspector a clean spreadsheet that looks just like what was originally uploaded, but in the optimized route sequence.

