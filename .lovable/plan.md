
# Add Day Summary Bar to SavedRoutes

## File: `src/components/SavedRoutes.tsx`

### Change: Replace redundant day header with summary bar (lines 333-351)

Remove the current day header block (lines 340-351 containing "Day {day.day_number}", date, mileage badge, and completion count) and replace the structure so the layout becomes:

1. The `days[selectedDayIndex]` IIFE now starts with the **summary bar** instead of the old header
2. Then the building cards follow directly (with the existing `visibleBuildings` filtering and empty-state message preserved)

The summary bar contains:
- **Row 1**: "Day N", stop count, mileage, completion fraction -- all inline with dot separators
- **Row 2** (conditional): Warning badges for advance notice count, escort count, and equipment count

The `visibleBuildings` variable and `hideComplete` filtering remain exactly as they are, applied to the building cards below the summary bar.

### Technical details

**Lines 333-351** are replaced. The new block:
- Keeps `const day = days[selectedDayIndex]` and `const visibleBuildings = ...`
- Adds computed counts: `completeCount`, `advanceNoticeCount`, `escortCount`, `equipmentCount`
- Renders the summary bar div with `bg-muted/30 border border-border`
- Warning badges use existing color patterns: `bg-warning/20 text-warning`, `bg-destructive/20 text-destructive`, `bg-blue-500/20 text-blue-400`
- Removes the old header `<div className="flex items-center justify-between">` block entirely

### What does NOT change
- Day picker chips above -- untouched
- Building cards below -- untouched
- Progress bar, hide-complete toggle -- untouched
- Field View + Delete buttons -- untouched
- All handlers and state -- untouched
