

# Extract SavedRoutes into its own file

## What changes

### New file: `src/components/SavedRoutes.tsx`

Contains everything from lines 586-958 of RouteBuilder.tsx:

- Interfaces: `SavedRoutePlan`, `SavedDayBuilding`, `SavedDay`
- `STATUS_CONFIG` constant (copy, not move -- RouteBuilder still uses it)
- `SavedRoutes` function component with all state, effects, handlers, JSX, dialogs
- Default export: `export default function SavedRoutes({ navigate }: { navigate: (path: string) => void })`

Imports needed in the new file:
- `useState, useEffect` from react
- UI components: Card, CardContent, CardHeader, CardTitle, Button, Badge, Switch, Label, Select components, Progress, Dialog components, AlertDialog components, Textarea
- Icons: Loader2, MapPin, ChevronDown, ChevronUp, Trash2, Smartphone, Check
- `toast` from sonner
- `supabase` from integrations

### Modified file: `src/pages/RouteBuilder.tsx`

- Add import: `import SavedRoutes from "@/components/SavedRoutes";`
- Delete lines 586-958 (interfaces, SavedRoutes component)
- The existing `<SavedRoutes navigate={navigate} />` call on line 524 stays unchanged
- `STATUS_CONFIG` and `STATUS_CYCLE` stay in RouteBuilder (used by BuildingRow and the generation wizard)
- Remove unused imports that were only needed by SavedRoutes: `Trash2`, `Smartphone` (keep all others since BuildingRow and RouteBuilder still use them)

### Zero behavior changes

This is a pure structural extraction. No logic, styling, or functionality changes.

## Technical notes

- `STATUS_CONFIG` is duplicated in both files intentionally -- RouteBuilder uses it in BuildingRow's status display and SavedRoutes uses it for the status select/badges
- The `Check` icon is used by both RouteBuilder (step indicator) and SavedRoutes (status config), so it stays imported in both
- RouteBuilder's remaining imports after cleanup: remove `Trash2`, `Smartphone` from the lucide import line (only used by SavedRoutes). All other imports stay since they're used by the generation wizard or BuildingRow.
