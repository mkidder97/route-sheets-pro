

## Responsive Tabs in CMProjectDetail.tsx

### Change
In `src/pages/cm/CMProjectDetail.tsx` at lines 263-266, add `className="w-full"` to `TabsList` and `className="flex-1"` to each `TabsTrigger` so the tab bar spans the full container width at any viewport size.

**Before:**
```tsx
<TabsList>
  <TabsTrigger value="visits">Visits</TabsTrigger>
  <TabsTrigger value="info">Project Info</TabsTrigger>
</TabsList>
```

**After:**
```tsx
<TabsList className="w-full">
  <TabsTrigger value="visits" className="flex-1">Visits</TabsTrigger>
  <TabsTrigger value="info" className="flex-1">Project Info</TabsTrigger>
</TabsList>
```

### Files Modified
- `src/pages/cm/CMProjectDetail.tsx` — 3 lines changed (263-265)

