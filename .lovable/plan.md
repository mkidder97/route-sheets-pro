
# Geocode Buildings at Import Time

## 1. Create `src/lib/geocoder.ts`

New utility file with two exported functions:

- `geocodeAddress(address, city, state, zipCode)` -- calls Nominatim API with 1-second rate limiting, returns `{ lat, lng }` or `null`
- `geocodeBuildingsBatch(buildings, onProgress?)` -- iterates buildings sequentially with 1.1s delay between calls, reports progress via callback, returns array of `GeocodingResult`

Uses `User-Agent: RoofRoute/1.0` header as required by Nominatim usage policy.

## 2. Add geocoding to RouteBuilder's `handleImport`

In `src/pages/RouteBuilder.tsx`:

- Add state: `const [geoProgress, setGeoProgress] = useState<{ completed: number; total: number } | null>(null)`
- After buildings are inserted (line ~277) and before auto-advancing to params (line ~286):
  1. Query the just-inserted buildings by `upload_id`
  2. Call `geocodeBuildingsBatch` with progress callback updating `geoProgress`
  3. Batch-update latitude/longitude back to Supabase for successful results
  4. Show toast: "Geocoded X of Y addresses"
- Reset `geoProgress` in `handleReset`
- Update the `step === "importing"` render block to show geocoding progress bar when `geoProgress` is set (showing "Geocoding addresses... X/Y" with a Progress component)
- Import `geocodeBuildingsBatch` from `@/lib/geocoder` and `Progress` from `@/components/ui/progress`

## 3. Add "Geocode Missing" button to Buildings page

In `src/pages/Buildings.tsx` (`BuildingsContent`):

- Add state for geocoding progress and a geocoding-active flag
- Compute count of buildings with `latitude === null` from the loaded data
- Add a card/button in the summary area showing "X buildings missing coordinates" with a "Geocode Now" button (only visible when count > 0)
- Clicking runs `geocodeBuildingsBatch` on those buildings, updates Supabase, refreshes the list, and shows a toast with results
- Show a progress dialog/indicator during geocoding

## What stays untouched

- `src/lib/geo-utils.ts`, `src/lib/route-clustering.ts`, SavedRoutes, MyRoutes, Settings
- Database schema (latitude/longitude columns already exist)
