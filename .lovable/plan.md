
# Move Buildings Between Days

## Overview
Add a "Move to Another Day" option to each building card in SavedRoutes, accessible from both the day view and the proximity-sorted view. Uses a Dialog listing available target days; on selection, updates the database and local state.

## Changes (all in `src/components/SavedRoutes.tsx`)

### 1. New imports
- `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger` from `@/components/ui/dropdown-menu`
- `ArrowRightLeft` from `lucide-react`

### 2. New state (after line ~111)
- `moveTarget: { buildingId: string; fromDayId: string; fromDayNumber: number } | null` (default null)
- `moving: boolean` (default false)

### 3. New `handleMoveBuilding(toDayId, toDayNumber)` function
- Finds max `stop_order` in the target day
- Updates `route_plan_buildings` row: sets `route_plan_day_id` to target day, `stop_order` to max+1
- Re-numbers remaining buildings in the source day (sequential stop_orders, no gaps) via individual updates
- Updates local `days` state: removes building from source day (re-numbering), appends to target day
- Shows success/error toast
- Resets `moveTarget`

### 4. "Move to Another Day" button in expanded cards
Added in two places, between the Navigate button and the status buttons:

- **Day view** (line ~898 area): Button with `ArrowRightLeft` icon, calls `setMoveTarget` with `buildingId`, current day's `id` and `day_number`
- **Proximity view** (line ~637 area): Same button, uses `b.dayId` and `b.dayNumber` from the flattened proximity list

### 5. Move confirmation Dialog (after the delete AlertDialog, line ~1009 area)
- Opens when `moveTarget` is set
- Lists all days except the source day, showing day number and building count
- Each day option calls `handleMoveBuilding`
- Cancel button clears `moveTarget`
- Disabled state while `moving` is true

### What stays untouched
- Geocoding, proximity sort, export, delete, status updates, progress bar
- Database schema (uses existing `route_plan_buildings` table)
- All other pages and components
