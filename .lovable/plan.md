

# Add "Data Import" to Admin Nav

## Single Change: `src/components/UnifiedLayout.tsx`

In the `NAV_SECTIONS` array, add `{ label: "Data Import", to: "/admin/data" }` to the Admin section's `items` array, positioned after "Regions" and before "Settings".

### Before
```typescript
items: [
  { label: "Users", to: "/admin/users" },
  { label: "Regions", to: "/admin/regions" },
  { label: "Settings", to: "/settings" },
],
```

### After
```typescript
items: [
  { label: "Users", to: "/admin/users" },
  { label: "Regions", to: "/admin/regions" },
  { label: "Data Import", to: "/admin/data" },
  { label: "Settings", to: "/settings" },
],
```

No other files change. The route `/admin/data` already exists in `App.tsx` pointing to `DataManager`.

