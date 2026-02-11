

# Fix Last Missing Building Coordinate

## Problem

One building remains without coordinates: **1706 Blairs Bridge Rd, Lithia Springs, GA 30112**. Both Nominatim and the zip centroid fallback failed because zip code 30112 is not in the bundled dataset.

## Solution

Manually update this single record in the database with its known coordinates (33.7748, -84.6580) via a SQL migration.

### Technical Details

Run a single SQL update:

```sql
UPDATE buildings
SET latitude = 33.7748, longitude = -84.6580
WHERE id = 'a2554298-afd7-489f-891a-a5a3221761d7';
```

This is a one-line database fix. No code changes needed.

