

# Add "Maint. Cost / 100K sqft" KPI Card to Dashboard

## Summary
Add a 7th KPI card showing the average estimated preventative maintenance budget per 100,000 square feet, and adjust the grid breakpoint so 7 cards wrap cleanly into two rows (4 + 3).

## Changes

All changes in a single file: `src/pages/Dashboard.tsx`

### 1. Update buildings query (line 149)
Add `preventative_budget_estimated` to the select string.

### 2. Update BuildingRow interface (line 42-57)
Add:
```ts
preventative_budget_estimated: number | null;
```

### 3. Add derived metric (after line 194, in the derived data section)
```ts
const maintBuildings = buildings.filter(
  (b) => b.preventative_budget_estimated != null && (b.square_footage ?? 0) > 0
);
const totalMaintBudget = maintBuildings.reduce(
  (s, b) => s + (b.preventative_budget_estimated ?? 0), 0
);
const totalMaintSqft = maintBuildings.reduce(
  (s, b) => s + (b.square_footage ?? 0), 0
);
const maintPer100k = totalMaintSqft > 0
  ? (totalMaintBudget / totalMaintSqft) * 100_000
  : 0;
```

### 4. Update KPI grid breakpoint (line 288)
Change `xl:grid-cols-6` to `xl:grid-cols-4` so 7 cards wrap into two rows (4 + 3).

### 5. Add 7th KPI card (after the Warranty Coverage card, before the closing `</div>` of the grid at line 363)
New card using amber/orange color scheme with `DollarSign` icon (already imported):
- Label: "Maint. Cost / 100K sqft"
- Value: `fmtMoney(maintPer100k)` (helper already exists)
- Subtext: `Based on ${maintBuildings.length} buildings with data`
- Icon container: `bg-amber-500/15`, icon color: `text-amber-400`

### 6. Update loading skeleton (line 252)
Change `xl:grid-cols-6` to `xl:grid-cols-4` and skeleton count from 6 to 7 to match.

No other dashboard changes.
