

# Create src/pages/Portfolio.tsx

## Summary
Create the Portfolio page component with client URL filtering, KPI stat cards, a searchable building table, and an active campaigns section -- all following existing patterns from Dashboard.tsx and Buildings.tsx.

## File: `src/pages/Portfolio.tsx` (new)

### URL Parameter Handling
- Read `?client=<uuid>` via `useSearchParams()`
- On mount, if param present, set `selectedClient` to that ID
- Client select changes update the URL with `navigate('/portfolio?client=...', { replace: true })`

### Data Fetching (Promise.all on mount)
1. **buildings**: `select('id, property_name, address, city, state, zip_code, square_footage, inspection_status, is_priority, is_deleted, client_id, clients(name), regions(name), inspectors(name)')` with `.or('is_deleted.is.null,is_deleted.eq.false')` ordered by `property_name`
2. **clients**: `select('id, name').eq('is_active', true).order('name')`
3. **inspection_campaigns**: `select('id, name, status, client_id, completed_buildings, total_buildings, end_date').neq('status', 'completed')`

All data fetched once; client filtering done client-side via `useMemo`.

### Header
- h1 "Portfolio" + subtitle "Client portfolio overview"
- shadcn Select with "All Clients" + each active client
- On change: updates URL and local state

### KPI Cards (4 cards, shown only when specific client selected)
Uses the standard KPI stat card pattern from the design system:
- **Total Buildings** -- blue icon, building count
- **Total Sq Footage** -- violet icon, formatted ("X.X M sq ft" or "X,XXX sq ft")
- **Inspection Completion** -- emerald icon, percentage with slim progress bar, "X of Y complete" subtext
- **Priority Buildings** -- amber icon, amber text if count > 0

### Building Table (always shown)
- Search input: client-side filter on property_name, address, city, zip_code
- Columns: Property Name (link to `/buildings/:id`) | Address | City | State | Status (colored Badge) | Priority (red "P" badge) | Sq Ft | Client (only in all-client view)
- Row hover: `cursor-pointer hover:bg-slate-700/50`, click navigates to `/buildings/:id`
- Sorted by property_name ascending (from query)
- Empty state: Building2 icon w-12 opacity-20 + "No buildings match your filters"

### Active Campaigns Section (shown only when client selected and campaigns exist)
- h2 "Active Campaigns" with ChevronRight link to `/inspections/campaigns`
- Each campaign card: name | status Badge | progress bar (completed/total with %) | end date
- Click navigates to `/inspections/campaigns/:id`

### Styling
- Dark theme per design system: `bg-slate-800 border-slate-700/50` cards, `bg-slate-900 border-slate-600` inputs
- KPI cards follow exact spec: `rounded-xl p-5`, `text-[10px] font-semibold uppercase tracking-widest text-slate-400` labels, `text-4xl font-bold text-white leading-none` numbers
- Lucide icons only, no emojis
- Table headers: `text-xs uppercase tracking-wider text-slate-400`
- Loading: centered `Loader2 animate-spin`

### Status Config
Reuses the same status color mapping pattern from Buildings.tsx:
- pending, in_progress, complete, completed, skipped, needs_revisit, active

### No other files changed
This only creates the new file. The route and lazy import already exist in App.tsx from the previous edit.

