

# Fix Geocoding for Missing 185 Buildings

## Problem

The geocoder ran correctly through all 424 buildings but Nominatim (the free OpenStreetMap API) simply returned no results for 185 addresses. This is not a rate-limit issue — it's an accuracy issue with commercial/industrial addresses containing abbreviations like "Ind Blvd", "Bldg.", "Pkwy", etc.

- Georgia: 59% failure rate (158/267)
- Texas: 17% failure rate (27/157)

## Solution: Multi-Strategy Geocoder with Zip Centroid Fallback

Update `src/lib/geocoder.ts` to try three strategies before giving up:

1. **Full address query** (current behavior) -- try the complete address string
2. **Simplified address** -- strip unit/building numbers, expand abbreviations (Blvd, Pkwy, Rd, Dr, etc.), retry
3. **Zip code centroid fallback** -- use the bundled `us-zip-centroids.json` dataset (already in the project) to place the building at the center of its zip code. Not street-level accurate, but good enough for route clustering and proximity sorting.

### Technical Details

**Changes to `src/lib/geocoder.ts`:**

- Update `geocodeAddress` to attempt the simplified address as a second try when the full address returns no results
- Add an `addressSimplify` helper that:
  - Removes parenthetical text, "Bldg" / "Building" / "Suite" / "Ste" suffixes
  - Expands common abbreviations (Rd, Dr, Blvd, Pkwy, Ln, Ct, Ave, NW/NE/SW/SE)
- Add a new exported function `geocodeBuildingsBatchWithFallback` (or update the existing batch function) that:
  - First tries Nominatim (with the retry logic above)
  - For any remaining failures, loads zip centroids via `loadZipCentroids()` from `geo-utils.ts` and fills in approximate coordinates
- The result will include a `source` field: `"nominatim"` or `"zip_centroid"` so the caller knows precision level

**Changes to `src/pages/Buildings.tsx`:**

- Update `handleGeocodeMissing` to use the improved batch function
- Toast message will show breakdown: "Geocoded X by address, Y by zip code, Z still missing"

**What stays untouched:**
- Route Builder import flow (already calls `geocodeBuildingsBatch` which will get the improvements)
- Database schema, geo-utils.ts, route-clustering.ts
- All other pages and components
