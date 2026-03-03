

# Field Interface Shell and CM Projects List

## Overview
Create a completely separate layout (`FieldLayout`) for field users with bottom nav (mobile) and icon sidebar (desktop), plus two initial pages: `FieldHome` (dashboard with assignments) and `CMProjectsList` (active CM projects). Update routing to wire everything up with role-based redirect after login.

## New Files

### 1. `src/components/FieldLayout.tsx`
- Full-screen dark layout (`bg-slate-900`), completely independent of UnifiedLayout
- **Header** (44px): RoofMind emblem on left, user full_name on right, LogOut icon button far right
- **Mobile** (`useIsMobile()`): bottom nav bar with 4 tabs — Home (`/field`), CM Jobs (`/field/cm`), Inspections (`/field/inspections`), Profile (`/field/profile`). Active tab gets blue-500 highlight, inactive gets slate-500
- **Desktop**: 64px-wide left icon sidebar with the same 4 items as vertical icon buttons with tooltips (using existing Tooltip component), no bottom bar
- **Content**: scrollable area between header and bottom nav, 16px padding, renders `<Outlet />`
- Uses `useAuth()` for profile name and signOut, `useLocation()` for active tab detection

### 2. `src/pages/field/FieldHome.tsx`
- Time-based greeting: "Good morning/afternoon/evening, [first name]" (split `profile.full_name` on space, take first segment)
- **Your Assignments** section: query `cm_visits` where `inspector_id = user.id` and `status = 'draft'`, joined with `cm_projects` (for project_name) and `buildings` (for property_name). Each item is a tappable card showing project name, visit number, visit date, building name. Tap navigates to `/field/cm/:projectId/visits/:visitId`
- Empty state: HardHat icon at 20% opacity + "No assignments yet" text
- **Coming Soon** section: 3 muted cards ("Annual Inspections", "Storm Inspections", "Due Diligence") each with Lock icon and "Coming Soon" badge, disabled appearance (opacity-50, no pointer events)

### 3. `src/pages/field/cm/CMProjectsList.tsx`
- Page title "CM Jobs"
- Search bar at top filtering by project name or building name
- Query `cm_projects` where `status = 'active'`, select building via `building_id` join on `buildings(property_name, address, city, state)`. Also count total visits and submitted visits per project from `cm_visits`
- Card list: each card shows project_name (bold), building property_name, address line, membrane_type, status badge, visit counts ("3 of 5 visits submitted")
- Tap card navigates to `/field/cm/:projectId`
- Empty state if no active projects
- FAB (fixed bottom-right, above bottom nav): blue circle with Plus icon, visible only to `admin` and `office_manager` roles, navigates to `/field/cm/new`

### 4. Placeholder pages
- `src/pages/field/cm/CMProjectDetail.tsx` — "Project detail coming soon" centered message
- `src/pages/field/FieldInspections.tsx` — "Coming soon" full screen message with Lock icon
- `src/pages/field/FieldProfile.tsx` — Shows user full_name, email, role badge, and a Sign Out button

### 5. `src/App.tsx` routing updates
- Add lazy imports for FieldLayout, FieldHome, CMProjectsList, CMProjectDetail, FieldInspections, FieldProfile
- Add route group: `<Route element={<ProtectedRoute><FieldLayout /></ProtectedRoute>}>` wrapping:
  - `/field` → FieldHome
  - `/field/cm` → CMProjectsList
  - `/field/cm/:projectId` → CMProjectDetail
  - `/field/cm/:projectId/visits/:visitId` → placeholder
  - `/field/inspections` → FieldInspections
  - `/field/profile` → FieldProfile

### 6. Login redirect by role
- In `src/pages/Login.tsx`, change the `from` default: if role is `inspector` or `construction_manager`, default redirect target is `/field` instead of `/dashboard`
- This requires reading `role` from `useAuth()` and adjusting line 15 logic

## Data Queries (FieldHome assignments)
```sql
-- Pseudocode for the Supabase client query
supabase
  .from('cm_visits')
  .select('id, visit_number, visit_date, status, cm_project_id, cm_projects(id, project_name, building_id, buildings(property_name))')
  .eq('inspector_id', user.id)
  .eq('status', 'draft')
  .order('visit_date')
```

## Data Queries (CMProjectsList)
Two queries: one for projects with building join, one for visit counts per project. Or a single query with aggregation handled client-side.

## Files Changed
- **New**: `src/components/FieldLayout.tsx`, `src/pages/field/FieldHome.tsx`, `src/pages/field/cm/CMProjectsList.tsx`, `src/pages/field/cm/CMProjectDetail.tsx`, `src/pages/field/FieldInspections.tsx`, `src/pages/field/FieldProfile.tsx`
- **Modified**: `src/App.tsx` (add lazy imports + field routes), `src/pages/Login.tsx` (role-based redirect)
- **Not modified**: UnifiedLayout.tsx, no existing office routes touched

