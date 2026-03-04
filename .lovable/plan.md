

# Unified Construction Management Page

## Overview
Create a new `src/pages/cm/ConstructionManagement.tsx` that combines CM Projects and CM Jobs (Pipeline) into a single two-tab hub. Update nav and routing accordingly.

## New File: `src/pages/cm/ConstructionManagement.tsx`

**Header**: "Construction Management" (`text-2xl font-bold`)

**Tabs**: "Active Projects" (default) | "Pipeline"

### Tab 1 — Active Projects
- **Filters**: Search input + status pills (All / Active / On Hold / Complete)
- **"New Project" button** top-right → `/cm/new`
- **Data query**: `cm_projects` joined to `buildings(property_name, city, state)`, plus left-joined `cm_visits` counts (total + submitted) per project. All statuses fetched (not filtered to active only like the field version). Order by `created_at DESC`.
- **Cards** (2-col grid on `lg:`, 1-col mobile): project name + status badge, building name + city/state, RI number + membrane type tags, contractor_name, contract dates, visit summary line
- **Card click** → `/cm/${projectId}`
- **Empty state**: icon + message + button to `/cm/new`
- Status badge colors: Active=green, On Hold=amber, Complete=gray

### Tab 2 — Pipeline
- Renders `<CMJobsBoard />` as-is, no modifications

## Routing: `App.tsx`
- Add lazy import: `const ConstructionManagement = lazy(() => import("./pages/cm/ConstructionManagement"))`
- Change `/cm` route from `CMProjectsList` to `ConstructionManagement`
- Keep `/cm/new`, `/ops/jobs` routes unchanged

## Nav: `UnifiedLayout.tsx`
- Operations items: remove "CM Projects" and "CM Jobs", add single item `{ label: "Construction", to: "/cm" }`
- Operations prefix array: ensure `/cm` is present, remove `/ops/jobs` (route still exists, just not in nav)

## Files Changed
1. **Created**: `src/pages/cm/ConstructionManagement.tsx`
2. **Modified**: `src/App.tsx` (swap lazy import + route)
3. **Modified**: `src/components/UnifiedLayout.tsx` (nav items)

## Not Changed
- `CMJobsBoard.tsx` — untouched
- `CMProjectsList.tsx` (field) — untouched
- `/ops/jobs` route — kept in App.tsx
- No database migrations needed

