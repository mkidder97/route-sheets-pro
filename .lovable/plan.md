

# Route Builder with Universal US Geocoding

## Summary
Build the Route Builder page with a nationwide zip code centroid dataset instead of hardcoded DFW data. This ensures the clustering algorithm works for any US region -- Dallas, Houston, Chicago, Atlanta, or anywhere else.

## Approach: Option A -- Bundled US Zip Code Dataset

A compressed JSON file of all ~42,000 US zip codes with lat/lng centroids will be added to the project. It loads lazily (dynamic import) so it doesn't affect initial page load. This gives instant coordinate lookups for any region with zero API calls.

## Database Changes

Three new tables for storing generated route plans:

- **route_plans** -- The overall plan (links client, region, inspector, date range, status: draft/finalized)
- **route_plan_days** -- Individual days within a plan (day number, date, estimated distance)
- **route_plan_buildings** -- Junction table linking buildings to days with stop order

Public RLS policies matching the existing pattern.

## New Files

### 1. `src/data/us-zip-centroids.json`
~42,000 entries structured as `{ "75050": [32.736, -97.020], ... }` using arrays instead of objects to minimize file size (~400-500KB). Sourced from public domain Census ZCTA data.

### 2. `src/lib/geo-utils.ts`
- `loadZipCentroids()` -- Lazy-loads the JSON dataset on first call, caches in memory
- `getCoordinates(zipCode)` -- Returns `{lat, lng}` from the dataset, or `null` if not found
- `haversineDistance(lat1, lng1, lat2, lng2)` -- Returns distance in miles between two points
- `estimateRouteDistance(buildings[])` -- Sums haversine distances between consecutive stops
- No DFW-specific references anywhere

### 3. `src/lib/route-clustering.ts`
Clustering algorithm:
1. Resolve coordinates for each building via zip centroid lookup
2. Separate priority buildings from regular ones
3. Sort by 3-digit zip prefix, then apply greedy nearest-neighbor (pick closest unvisited building)
4. Group 24-hour-notice buildings so they land on days allowing advance scheduling
5. Prefer grouping same access types within a day
6. Slice into daily chunks based on the "buildings per day" target
7. Place priority buildings first while maintaining geographic grouping
8. Buildings with unknown zip codes are still included -- placed at the end of clusters with a warning, distance calculation skipped for those hops

### 4. `src/pages/RouteBuilder.tsx`
Three-step wizard:

**Step 1 -- Parameters**: Client/Region/Inspector dropdowns (each filtering the next), date range picker, buildings-per-day slider (3-8, default 5), "Generate Routes" button.

**Step 2 -- Review and Adjust**: Day-by-day card layout. Each card shows buildings with name, address, zip, sqft, access type, priority badge, and estimated daily driving distance. Drag-and-drop between days using native HTML drag API. "Remove" button returns buildings to an unassigned pool at the bottom.

**Step 3 -- Save**: "Finalize Routes" writes to the three new tables. Success toast with summary.

### 5. Navigation updates
- Add "Route Builder" link to `AppSidebar.tsx`
- Add `/route-builder` route to `App.tsx`

## Graceful Fallbacks
- If a zip code is missing from the dataset, the building is still included in clustering (grouped by 3-digit prefix) but excluded from distance calculations
- If no buildings have resolvable coordinates, clustering falls back to zip prefix grouping only (Option C behavior)
- Console warnings logged for unresolvable zip codes

