

# Wire My Routes to Settings Inspector Preference

## 1. Rewrite `src/pages/MyRoutes.tsx`

- Remove the Select dropdown and its imports
- Initialize `selectedId` from `localStorage.getItem("roofroute_inspector_id")`
- Add a `storage` event listener for cross-tab sync
- Keep the inspector fetch (for name resolution in subtitle)
- Add first-visit empty state with a "Go to Settings" button (using Card, Button, useNavigate)
- Add a "Switch inspector" link below subtitle when inspector is set
- Make heading responsive: `text-xl sm:text-2xl`

## 2. Update Route Builder defaults (`src/pages/RouteBuilder.tsx`)

Three state initializers read from localStorage:

- `buildingsPerDay`: read `roofroute_default_buildings_per_day`, parse as int, fallback 5
- `useStartLocation`: true if `roofroute_default_start_location` is non-empty
- `startLocation`: read `roofroute_default_start_location`, fallback ""

Changes are on lines 67-69 only.

## 3. What stays untouched

- SavedRoutes.tsx, Settings.tsx, DataManager.tsx, AppSidebar.tsx, App.tsx
- All Supabase tables

