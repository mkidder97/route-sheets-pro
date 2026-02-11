

# Add "Sort by Location" to SavedRoutes

## 1. Update `SavedDayBuilding` interface and query

- Add `latitude: number | null` and `longitude: number | null` to the `SavedDayBuilding` interface (line ~51)
- Update the buildings select string in `toggleExpand` (line ~168) to include `latitude, longitude`
- Map them in the result builder (lines ~180-201)

## 2. Add new state variables

After existing state declarations (around line 101):

- `locationSort: boolean` (default false)
- `userLocation: { lat: number; lng: number } | null` (default null)
- `locationLoading: boolean` (default false)
- `priorityFirst: boolean` (default true)

## 3. Add `handleLocationSort` function

Uses `navigator.geolocation.getCurrentPosition` with high accuracy, 10s timeout, 60s max age. On success sets `userLocation` and `locationSort = true`. On error shows a toast.

## 4. Compute `sortedByDistance` with `useMemo`

- Import `useMemo` from React and `haversineDistance` from `@/lib/geo-utils`
- Import `Crosshair` (or `LocateFixed`) from lucide-react for the button icon
- Flatten all buildings from all days, annotate with `dayNumber` and `dayId`
- Calculate distance from `userLocation` using `haversineDistance`
- If `priorityFirst`, sort priorities first then non-priorities, each sub-group by distance
- Buildings without coords get `distanceMiles = null` and sort to the bottom (999 fallback)

## 5. Add UI controls between progress bar and day picker

Inside the expanded plan area (after the hide-complete toggle, before day picker chips):

- "Sort by Location" button with Crosshair icon (shows loading spinner when getting GPS)
- When active: shows a "Priority first" checkbox toggle and a "Back to Days" button
- When `locationSort` is true, hide the day picker chips and day summary bar

## 6. Render proximity-sorted view

When `locationSort && userLocation` is true, render the flat sorted list instead of the day view:

- Each building card shows: property name, priority badge, status badge, distance (miles or feet), address, "Day X" label, access codes, sq ft
- Distance display: less than 1 mile shows feet, otherwise shows miles with 1 decimal; null coords show "No coords" in muted text
- Expanded card content is identical to the existing day view (access details, equipment, notes, property manager, navigate button, status buttons)
- Respects the "Hide completed" toggle

## 7. Reset location sort state

- Reset `locationSort`, `userLocation`, `locationLoading` when collapsing a plan (in `toggleExpand`)
- Reset when switching plans

## What stays untouched

- Day view, day picker, day summary (hidden when location sort active, shown otherwise)
- Status update logic, export, delete, progress bar
- All other pages and components

