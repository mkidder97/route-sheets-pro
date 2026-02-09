

# Fix: Sort Individual Buildings (Not Days) in Schedule Excel

## Root Cause

The current Excel generator sorts **day chunks** by their first building's geography, then flattens buildings within each day in their original order. But Wildlife 11 (75050, Grand Prairie) is saved **inside the same day chunk** as Live Oak buildings (75056, The Colony) -- because that's how the route builder grouped them (5 buildings per day).

Sorting days by first building doesn't fix this because Wildlife 11 is mixed into a day with Live Oak buildings. No amount of day-level sorting will separate it.

## The Fix

In `src/lib/excel-generator.ts`, change the flattening logic to:

1. Extract ALL buildings from ALL days into a single flat array
2. Sort that flat array by state, then city, then zip code
3. Assign continuous stop numbers (1 through N) on the sorted result

This completely ignores day boundaries for the schedule Excel, which is correct -- the office staff doesn't care about day groupings, they need a geographically organized master list.

### Changes to `src/lib/excel-generator.ts`

Replace the current approach (sort days, then flatMap buildings) with:

```text
1. Flatten: collect every building from every day into one array
2. Sort the flat array by: state -> city -> zip_code -> property_name
3. Assign stop numbers 1..N
4. Generate rows
```

This guarantees all 75056 (The Colony) buildings are together, all 75050 (Grand Prairie) buildings are together, etc. No building from a different zip can ever appear between buildings of the same zip.

## Why Previous Fixes Didn't Work

- **Zip tiebreaker in nearest-neighbor**: Only helps when generating new routes. The schedule reads already-saved route data from the database, so the tiebreaker doesn't apply at export time.
- **Day-level geographic sort**: Moves whole day chunks around but can't fix interleaving within a single day chunk.
- **sortByPriority flag**: Only affects future route generation, not already-saved data.

## Files Changed

1. **`src/lib/excel-generator.ts`** -- Replace day-level sort + flatMap with building-level sort

