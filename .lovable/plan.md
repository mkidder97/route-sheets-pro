

# Create Settings Page with Tabbed Interface

## 1. Refactor existing pages to export content components

### Buildings.tsx
- Extract everything below the page header into a new named export `BuildingsContent`
- All state, hooks, and logic stay inside `BuildingsContent`
- Default export `Buildings` becomes a wrapper: renders the header (`<h1>`, subtitle) then `<BuildingsContent />`

### Codes.tsx
- Same pattern: extract into a named export `CodesContent`
- Default export `Codes` renders header + `<CodesContent />`

### Inspectors.tsx
- Same pattern: extract into a named export `InspectorsContent`
- Default export `Inspectors` renders header + `<InspectorsContent />`

## 2. Create `src/pages/Settings.tsx` (new file)

- Page heading: "Settings" with subtitle "Manage buildings, codes, and inspectors"
- Uses `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` from `@/components/ui/tabs`
- Three tabs: "Buildings", "Codes", "Inspectors"
- Each tab panel renders the corresponding Content component
- Default tab: "buildings"
- Tab re-fetch on switch is accepted (no `forceMount`) -- these are low-frequency admin tools and keeping it simple is the right tradeoff

## 3. Update `src/App.tsx`

- Import `Settings` from `./pages/Settings`
- Add route: `<Route path="/settings" element={<Settings />} />`
- Keep existing `/buildings`, `/codes`, `/inspectors` routes (cleaned up in a later prompt)

## 4. Update `src/components/AppSidebar.tsx`

- Import `Settings as SettingsIcon` from `lucide-react` (gear icon -- aliased to avoid collision with the page component name)
- Remove `Users` and `KeyRound` from the lucide import (confirmed only used in `manageNav`)
- Keep `Building2` (used in logo)
- Delete the `manageNav` array entirely
- Delete the second `SidebarGroup` (the "Manage" group, lines 72-94)
- Add Settings to `mainNav` as the last item: `{ title: "Settings", url: "/settings", icon: SettingsIcon }`
- Final `mainNav` order: **My Routes, Upload, Route Builder, Settings** (explicit ordering, no reordering)
- Single sidebar group labeled "Navigation"

## What stays untouched
- Individual page files continue to work at their own routes
- Upload stays in the nav as an intermediate state before the merge prompt
- All database tables, SavedRoutes, RouteBuilder, MyRoutes
- `ChevronLeft` stays in the import (out of scope)

