

# Create My Routes Page and Wire It Up

## 1. Create `src/pages/MyRoutes.tsx` (new file)

- Page heading: "My Routes"
- Inspector selector dropdown using `Select` from `@/components/ui/select`
- Query inspectors with region join: `.select("id, name, regions(name)")` so each option shows "Michael Kidder -- Dallas/Fort Worth"
- Store selected `inspectorId` in state
- When inspector is selected, subtitle updates to show inspector name and region (e.g., "Michael Kidder -- Dallas/Fort Worth") instead of static text
- If no inspector selected: placeholder message "Select your name above to view your routes."
- If inspector selected: render `<SavedRoutes inspectorId={inspectorId} />`

## 2. Modify `src/components/SavedRoutes.tsx`

### Signature change
- From: `export default function SavedRoutes()`
- To: `export default function SavedRoutes({ inspectorId }: { inspectorId?: string })`

### Filter in `loadPlans`
- When `inspectorId` is provided, add `.eq("inspector_id", inspectorId)` to the query built inside `loadPlans`
- The query currently chains `.select(...)`, `.order(...)`, `.limit(50)` -- insert the conditional `.eq()` before `.order()`

### Reset stale state on inspector change
- Add `inspectorId` to the `useEffect` dependency array that calls `loadPlans` (currently `[]`)
- In the same effect, reset `expandedPlan` to `null`, `expandedBuilding` to `null`, `selectedDayIndex` to `0`, and `days` to `[]` before calling `loadPlans` -- this prevents stale expanded cards from a previous inspector showing through

## 3. Update `src/App.tsx`

- Add import for `MyRoutes`
- Change root route: `<Route path="/" element={<MyRoutes />} />`
- Add: `<Route path="/my-routes" element={<MyRoutes />} />`
- Move Dashboard: `<Route path="/dashboard" element={<Dashboard />} />`

## 4. Update `src/components/AppSidebar.tsx`

- Remove `LayoutDashboard` from the lucide-react import
- Change first `mainNav` entry from `{ title: "Dashboard", url: "/", icon: LayoutDashboard }` to `{ title: "My Routes", url: "/", icon: Route }` (Route icon already imported)

## What stays untouched
- SavedRoutes still renders inside RouteBuilder (both locations work during transition)
- All other pages, components, database tables
- RouteBuilder still passes no props to SavedRoutes (inspectorId defaults to undefined, loading all routes)

