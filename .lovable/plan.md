

## Rebuild FieldInspections as a 5-Tab Page

### Single file change: `src/pages/field/FieldInspections.tsx`

Replace entire contents with a tabbed component containing:

**Imports**: `useAuth`, `useState`, `FieldTodayView`, `CodesContent` (named from `@/pages/Codes`), `useQuery`, `supabase`, Tabs components, `Input`, `Badge`, `Progress`, lucide icons (`Search, Building2, KeyRound, ClipboardCheck, History, Route, Loader2`), `format` from date-fns.

**Tabs layout**: Full-width `TabsList` with 5 equal triggers: Route, Campaign, Buildings, Codes, History. Default tab: `route`.

**Tab 1 — Route**: Conditional render of `<FieldTodayView>` if `inspector_id` exists, else fallback with Route icon.

**Tab 2 — Campaign**: `useQuery` fetches inspector's `region_id`, then active campaign for that region. Shows campaign card with name, type badge, date range, progress bar, completion count. Loading/empty states.

**Tab 3 — Buildings**: Local `search` state. `useQuery` fetches buildings (filtered by name when 2+ chars typed). Renders search input + result cards showing property name, address, access type, lock codes, special notes. Empty/loading states.

**Tab 4 — Codes**: Renders `<CodesContent />` directly.

**Tab 5 — History**: Placeholder with History icon + "Coming soon".

All styled dark theme (bg-slate-800/50 cards, border-slate-700/50, text-slate-100).

