

# Fix Route Ordering: Remove Zip Prefix Grouping

## Root Cause

The `greedyNearestNeighbor()` function in `src/lib/route-clustering.ts` (lines 119-145) splits buildings into groups by the first 3 digits of the zip code, then runs nearest-neighbor sorting independently within each group. The groups are concatenated in arbitrary order.

This causes two problems:
- Buildings in the same city can have different 3-digit prefixes and get separated
- The boundary between groups creates jumps -- the last building of one group may be far from the first building of the next

## The Fix

Replace `greedyNearestNeighbor()` with a direct call to `nearestNeighborChain()` on ALL buildings at once. The nearest-neighbor algorithm naturally clusters nearby buildings together without needing artificial zip-based grouping.

### Changes to `src/lib/route-clustering.ts`

1. **Replace the `greedyNearestNeighbor` function body** -- remove the 3-digit prefix grouping logic and just call `nearestNeighborChain(buildings, startCoords)` directly
2. **Delete the unused `refineByAccessType` function** (dead code cleanup)

### Also fix Notes column in `src/lib/excel-generator.ts`

The community `xlsx` library (SheetJS) does not support cell styling (the `.s` property) in the free/open-source version. The `wrapText` code added previously has no effect. Instead:
- Ensure the column width is generous (already set to 70)
- No further action needed from code -- the user should widen the column manually in Excel if 70 chars isn't enough, or we can increase it further

## Result

- One continuous nearest-neighbor chain across all buildings
- Same-city buildings stay together naturally
- No artificial zip-prefix boundaries breaking the route

