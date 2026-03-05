

## Update Inspections Nav Section in UnifiedLayout

### Change

In `src/components/UnifiedLayout.tsx`, modify the Inspections entry in `NAV_SECTIONS` (~lines 46-56):

**Current:**
```tsx
{
  label: "Inspections",
  icon: ClipboardCheck,
  prefix: ["/inspections", "/route-builder", "/my-routes"],
  items: [
    { label: "My Routes", to: "/my-routes" },
    { label: "Campaigns", to: "/inspections/campaigns" },
    { label: "Route Plans", to: "/route-builder" },
    { label: "Schedule", to: "/inspections/schedule" },
    { label: "History", to: "/inspections/history" },
  ],
},
```

**After:**
```tsx
{
  label: "Inspections",
  icon: ClipboardCheck,
  prefix: ["/inspections", "/route-builder"],
  items: [
    { label: "Campaigns", to: "/inspections/campaigns" },
    { label: "Route Planner", to: "/route-builder" },
    { label: "History", to: "/inspections/history" },
  ],
},
```

### Files Modified
- `src/components/UnifiedLayout.tsx` — `NAV_SECTIONS` array only

