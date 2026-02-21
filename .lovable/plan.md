

# Schedule Upload — Updated Plan Notes

This is an addendum to the previously approved plan, addressing three edge cases.

## 1. Date parsing: Use date-fns (already installed)

`date-fns` v3.6.0 is already a project dependency. The `parseScheduledWeek` function in `src/lib/schedule-parser.ts` will use:

```ts
import { startOfWeek, parse } from "date-fns";

const monday = startOfWeek(parsedDate, { weekStartsOn: 1 });
```

No new dependencies needed.

## 2. Duplicate campaign_buildings: Not an issue

A unique constraint already exists on `(campaign_id, building_id)`:
```
campaign_buildings_campaign_id_building_id_key UNIQUE (campaign_id, building_id)
```

The match query will always return at most one `campaign_buildings` row per building per campaign. No special handling needed.

## 3. Inspector matching: Add last-name fallback

Enhance the inspector matching logic with a two-pass approach:

1. **Exact match** (case-insensitive, trimmed) -- e.g. "Michael Kidder" === "Michael Kidder"
2. **Last-name fallback** -- extract the last token from the uploaded name and match against the last token of each inspector name. If exactly one inspector matches by last name, use it. If multiple match, leave unmatched.
3. **Unmatched inspectors** get flagged in the preview with an amber badge ("Inspector not matched") and a dropdown to manually select from the inspectors list -- same pattern as the manual building fix.

```ts
function matchInspector(uploadedName: string, inspectors: { id: string; name: string }[]) {
  const norm = (s: string) => s.toLowerCase().trim();
  // Pass 1: exact
  const exact = inspectors.find(i => norm(i.name) === norm(uploadedName));
  if (exact) return exact;
  // Pass 2: last-name
  const uploadedLast = norm(uploadedName).split(/[\s,]+/).pop() || "";
  const lastNameMatches = inspectors.filter(i => {
    const inspLast = norm(i.name).split(/\s+/).pop() || "";
    return inspLast === uploadedLast && uploadedLast.length > 1;
  });
  return lastNameMatches.length === 1 ? lastNameMatches[0] : null;
}
```

This handles "Kidder, Michael", "M. Kidder", and "Kidder" variations while avoiding false positives when multiple inspectors share a last name.

## Everything else remains unchanged from the approved plan

- 4-step wizard structure
- File parsing with XLSX
- Column mapping with fuzzy match
- Building matching (building_code primary, address fallback)
- Color-coded preview table
- Manual fix dropdowns for unmatched rows
- One-at-a-time campaign_buildings updates
- Integration into OpsScheduling page header

