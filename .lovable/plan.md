

# Fix Route Clustering: Remove Geographic-Breaking Logic

## Problem
Two functions in `src/lib/route-clustering.ts` break geographic grouping:

1. **`insertPriorityBuildings()`** splices priority buildings into arbitrary positions, splitting clusters (e.g., Live Oak buildings separated by Grand Prairie)
2. **`groupAdvanceNotice()`** pulls advance-notice buildings out of their geographic position and appends them at the end

## Changes to `src/lib/route-clustering.ts`

### 1. Remove priority separation entirely
- Stop splitting buildings into `priority` and `regular` arrays (lines ~80-81)
- Feed ALL buildings (priority and regular) into `greedyNearestNeighbor()` together
- Remove the call to `insertPriorityBuildings()` (line ~87)
- Delete the `insertPriorityBuildings()` function

### 2. Remove `groupAdvanceNotice()` call
- Remove the call on line ~90 so buildings stay in geographic order
- Delete the `groupAdvanceNotice()` function

### 3. Bias priority-heavy clusters toward early days
After chunking into daily groups, sort the day chunks so that chunks with more priority buildings come first:
- Count priority buildings per chunk
- Sort chunks: higher priority count = earlier day number
- This puts priority-dense geographic clusters on Day 1-2 without breaking the within-cluster route order

### 4. Also widen Excel columns
In `src/lib/excel-generator.ts`, increase:
- Notes: 30 -> 50
- Access Location: 32 -> 40

## Result
- All buildings sorted by pure nearest-neighbor geography
- No zigzagging caused by priority or advance-notice shuffling
- Priority clusters naturally land earlier in the schedule
- Excel columns wide enough for field use

