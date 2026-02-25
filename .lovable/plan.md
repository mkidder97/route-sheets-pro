

# Wire Buildings Page to /buildings Route

## Summary

Two small changes in `src/App.tsx` to point `/buildings` at the real Buildings page and move DataManager to `/admin/data`.

## Changes (src/App.tsx only)

### 1. Add lazy import for Buildings (after line 15)

Add:
```tsx
const Buildings = lazy(() => import("./pages/Buildings"));
```

### 2. Update route at line 61

Change:
```tsx
<Route path="/buildings" element={<DataManager />} />
```
To:
```tsx
<Route path="/buildings" element={<Buildings />} />
<Route path="/admin/data" element={<DataManager />} />
```

## No other files change

- `UnifiedLayout.tsx` already has `{ label: "Buildings", to: "/buildings" }` -- no change needed
- `Buildings.tsx` is untouched
- No Supabase, nav, or styling changes

## Result

Portfolio > Buildings will show the buildings table with search/filters instead of the CSV upload tool. DataManager remains accessible at `/admin/data`.

