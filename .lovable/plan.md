

# Restructure: Buildings, Inspectors, Saved Routes with Synced Status Tracking, Mobile Layout

## Key Clarification: Shared Status

When a user updates a building's status from the Saved Routes section in Route Builder, it writes directly to the `buildings` table (`inspection_status`, `completion_date`, `inspector_notes`). The Buildings page reads from the same table. So status is always in sync -- there is one source of truth.

## Changes

### 1. Create Buildings Page (`src/pages/Buildings.tsx`)

Searchable, filterable table of all buildings with inline status management:

- **Search bar** filtering by property name, address, city, zip
- **Filter dropdowns**: client, region, inspector, inspection status
- **Table columns**: Property Name, Address, City, State, Zip, Status, Priority, Inspector
- **Inline status cycling**: click status badge to toggle (pending -> complete -> skipped -> needs_revisit -> pending), updates `buildings.inspection_status` in database
- **Note dialog**: required when marking skipped or needs_revisit, saves to `buildings.inspector_notes`
- **Expandable row**: shows codes, access info, notes, square footage, special equipment, editable inspector_notes
- **Summary bar at top**: total buildings, completed count/percentage, priority completion count

### 2. Create Inspectors Page (`src/pages/Inspectors.tsx`)

Inspector management with progress stats:

- **Table**: name, region, building count, completion %, priority count
- **Add inspector**: dialog with name and region select
- **Edit inspector**: inline name edit, region reassignment
- **Delete inspector**: confirmation, warns if buildings assigned
- **Expandable detail**: progress bar, assigned buildings grouped by status

### 3. Add Saved Routes to Route Builder (`src/pages/RouteBuilder.tsx`)

A "Saved Routes" section below the route generation flow:

- **List all route plans**: name, client, region, inspector, date, total buildings, completion stats (X/Y complete)
- **Expand a route** to see day-by-day breakdown:
  - Per-day completion count ("3/5 complete") and progress bar
  - Building list with color-coded status badges
  - Click status badge to cycle -- writes to `buildings.inspection_status` (same table the Buildings page reads)
  - Note dialog for skipped/needs_revisit -- writes to `buildings.inspector_notes`
  - Completion date auto-set when marked complete -- writes to `buildings.completion_date`
- **"Open in Field View"** button per route: navigates to `/field?plan={id}`
- **Delete route** with confirmation
- Update "done" step to link to the saved route

### 4. Status Data Flow

All three views (Buildings page, Saved Routes in Route Builder, Field View) read and write the same columns on the `buildings` table:

```text
buildings.inspection_status  -- the status value
buildings.completion_date    -- set when marked complete
buildings.inspector_notes    -- notes for skipped/revisit
buildings.photo_url          -- placeholder for future photo upload
```

No separate status tables needed. Any status change in Saved Routes is immediately visible on the Buildings page and vice versa.

### 5. Update Field View (`src/pages/FieldView.tsx`)

- Read `plan` query parameter from URL to auto-select a route plan
- Keep dropdown for manual selection as fallback

### 6. Clean Up Schedules (`src/pages/Schedules.tsx`)

- Remove status tracking step, status state, toggle logic, note dialog, STATUS_COLORS
- Remove "View & Track Status" button
- Schedules remains focused on document generation only

### 7. Navigation Updates

- **Remove** Field View from sidebar (accessed via Route Builder saved routes)
- Keep `/field` route in router

### 8. Mobile-Friendly Layout

**`src/components/AppLayout.tsx`**:
- Mobile top bar with hamburger menu button
- Sidebar hidden by default on small screens, opens as sheet/drawer overlay
- Reduced padding on mobile

**All pages**:
- Tables wrapped with `overflow-x-auto`
- Grids stack on mobile
- Compact spacing on small screens

### 9. Register Routes (`src/App.tsx`)

- Add `/buildings` route
- Add `/inspectors` route

## Files

| File | Action |
|------|--------|
| `src/pages/Buildings.tsx` | Create |
| `src/pages/Inspectors.tsx` | Create |
| `src/pages/RouteBuilder.tsx` | Add saved routes with status tracking |
| `src/pages/FieldView.tsx` | Read plan query param |
| `src/pages/Schedules.tsx` | Remove status tracking |
| `src/components/AppSidebar.tsx` | Remove Field View nav item |
| `src/components/AppLayout.tsx` | Mobile hamburger layout |
| `src/App.tsx` | Add new routes |

## No Database Changes

All columns (`inspection_status`, `completion_date`, `inspector_notes`, `photo_url`) already exist on the `buildings` table from the previous migration.

