

# Fix: Zip Code Tiebreaker in Nearest-Neighbor + Remove Priority Reorder for Schedule Excel

## Root Cause

Two issues combine to put Wildlife 11 (Grand Prairie, 75050) between Live Oak buildings (The Colony, 75056):

### Issue 1: No tiebreaker for same-centroid buildings
All Live Oak buildings have no actual lat/lng, so they all resolve to the identical 75056 zip centroid point. Wildlife 11 resolves to the 75050 centroid, which is nearby. When the nearest-neighbor algorithm picks the next building, it sees distance=0 for remaining Live Oak buildings AND a very small distance for Wildlife 11. Without a tiebreaker, Wildlife 11 can slip in between Live Oak buildings.

### Issue 2: Priority chunk reordering breaks geographic sequence
After the global nearest-neighbor sort, buildings are sliced into daily chunks, then those chunks are re-sorted by priority count (line 93-97). This shuffles the geographic order of chunks. When the Excel generator flattens all chunks with continuous stop numbers (1-N), the geographic sequence is broken.

## Fix

### Change 1: Add zip code tiebreaker to `nearestNeighborChain` in `src/lib/route-clustering.ts`

When two candidates have similar distances (within ~1 mile, which covers same-centroid and very nearby centroids), prefer the candidate with the **same zip code** as the current building. This keeps same-zip buildings together.

```text
In the inner loop of nearestNeighborChain:
- When a candidate distance is within 1 mile of the best distance found so far
- AND the candidate shares the same zip_code as the last building in the chain
- AND the current best does NOT share the same zip
- Then prefer the same-zip candidate (update bestIdx)
```

### Change 2: Remove priority chunk reordering for schedule use

The priority reordering (sorting day chunks by priority count) makes sense for the Route Builder (inspector perspective) but breaks the continuous geographic order needed for the schedule Excel.

The approach: keep the priority sort in `generateClusters` (it's used by Route Builder), but in the Excel generator, re-sort the days by their original geographic order before flattening. Since we don't have the original order stored, the simpler fix is to move the priority sort logic so it only applies when the data is used for route builder context, not schedule context.

Specifically: the `generateClusters` function will accept an optional `sortByPriority` parameter (default `true`). The Schedules page will pass `false` so chunks stay in geographic order. The Route Builder continues to pass `true` (or use the default).

### Files Changed

1. **`src/lib/route-clustering.ts`**
   - Add zip-code tiebreaker logic to `nearestNeighborChain`
   - Add optional `sortByPriority` parameter to `generateClusters`

2. **`src/pages/RouteBuilder.tsx`** (or wherever it calls `generateClusters`)
   - No change needed (uses default `sortByPriority=true`)

3. **`src/pages/Schedules.tsx`**
   - If it calls `generateClusters`, pass `sortByPriority: false`
   - If it only reads from the database (already-saved route plans), the fix is in how the data was saved — verify the save path

## Expected Result
- All Live Oak buildings group together without Wildlife 11 interrupting
- Same-city, same-zip buildings always cluster as a block
- Schedule Excel shows a logical geographic sequence with continuous stop numbers
- Route Builder still prioritizes days with priority buildings first

