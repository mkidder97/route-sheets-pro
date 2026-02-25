

# Phase 1: Unified Navigation (RoofMind)

## Overview

Replace both separate layouts with a single `UnifiedLayout` featuring a persistent top navigation bar. Brand name **RoofMind** used only in `UnifiedLayout.tsx` and `Login.tsx`. All other existing files remain untouched (no branding sweep).

---

## New Files to Create

### 1. `src/components/UnifiedLayout.tsx`

Single layout component replacing both AppLayout and OpsLayout.

**Desktop** (lg and up):
- Sticky top nav bar (h-14, bg-background, border-b)
- Left side: Building2 icon + "RoofMind" text
- Center: `NavigationMenu` with these items:
  - **Dashboard** -- plain `Link` to `/dashboard` styled with `navigationMenuTriggerStyle()`
  - **Portfolio** -- `NavigationMenuTrigger` + `NavigationMenuContent` grid with: Buildings (`/buildings`), Clients (`/clients`), Contacts (`/contacts`), Contractors (`/contractors`), Warranties (`/warranties`), Budgets (`/budgets`)
  - **Inspections** -- dropdown: Campaigns (`/inspections/campaigns`), Route Plans (`/route-builder`), Schedule (`/inspections/schedule`), History (`/inspections/history`)
  - **Operations** -- dropdown: CM Jobs (`/ops/jobs`), Work Orders (`/ops/work-orders`), Mileage (`/ops/time-mileage`), PTO (`/ops/scheduling`)
  - **Admin** -- dropdown: Users (`/admin/users`), Regions (`/admin/regions`), Settings (`/settings`)
- Right side: `NotificationBell`, user's `profile?.full_name`, Sign Out button
- Each dropdown trigger highlights (text-primary) when `location.pathname` starts with its prefix

**Mobile** (below lg):
- Top bar: hamburger (Menu icon) + "RoofMind" + NotificationBell
- Hamburger opens `Drawer` (from vaul/drawer component) with collapsible nav sections listing all links
- No mobile bottom tab bar

**Content area**: `<main className="flex-1 overflow-auto"><div className="p-4 lg:p-8"><Outlet /></div></main>`

Imports: `useAuth`, `useLocation`, `Link` (react-router-dom), `Outlet`, `NavigationMenu*` components, `NotificationBell`, `Drawer*` components, lucide icons, `useIsMobile`.

### 2. Placeholder Pages (12 files)

Each follows this pattern -- a default export with heading + "Coming Soon" badge + card:

- `src/pages/Dashboard.tsx` -- "Dashboard"
- `src/pages/Clients.tsx` -- "Clients"
- `src/pages/Contacts.tsx` -- "Contacts"
- `src/pages/Contractors.tsx` -- "Contractors"
- `src/pages/Warranties.tsx` -- "Warranties"
- `src/pages/Budgets.tsx` -- "Budgets"
- `src/pages/inspections/Campaigns.tsx` -- "Inspection Campaigns"
- `src/pages/inspections/Schedule.tsx` -- "Inspection Schedule"
- `src/pages/inspections/History.tsx` -- "Inspection History"
- `src/pages/ops/OpsWorkOrders.tsx` -- "Work Orders"
- `src/pages/admin/Users.tsx` -- "Users"
- `src/pages/admin/Regions.tsx` -- "Regions"

---

## Files to Modify

### 3. `src/App.tsx`

- Remove imports: `AppLayout`, `OpsLayout`
- Add import: `UnifiedLayout` (lazy)
- Add lazy imports for all 12 placeholder pages
- Replace both route groups with single unified group:

```
<Route path="/login" element={<Login />} />
<Route path="/ops/login" element={<Navigate to="/login" replace />} />

<Route element={<ProtectedRoute><UnifiedLayout /></ProtectedRoute>}>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/my-routes" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={<Dashboard />} />

  <Route path="/buildings" element={<DataManager />} />
  <Route path="/clients" element={<Clients />} />
  <Route path="/contacts" element={<Contacts />} />
  <Route path="/contractors" element={<Contractors />} />
  <Route path="/warranties" element={<Warranties />} />
  <Route path="/budgets" element={<Budgets />} />

  <Route path="/inspections/campaigns" element={<InspectionCampaigns />} />
  <Route path="/route-builder" element={<RouteBuilder />} />
  <Route path="/inspections/schedule" element={<InspectionSchedule />} />
  <Route path="/inspections/history" element={<InspectionHistory />} />

  <Route path="/ops" element={<Navigate to="/ops/jobs" replace />} />
  <Route path="/ops/jobs" element={<OpsJobBoard />} />
  <Route path="/ops/jobs/campaign/:id" element={<OpsCampaignDetail />} />
  <Route path="/ops/work-orders" element={<OpsWorkOrders />} />
  <Route path="/ops/time-mileage" element={<OpsTimeMileage />} />
  <Route path="/ops/scheduling" element={<OpsScheduling />} />

  <Route path="/admin/users" element={<AdminUsers />} />
  <Route path="/admin/regions" element={<AdminRegions />} />
  <Route path="/settings" element={
    <ProtectedRoute allowedRoles={["admin","office_manager"]}><Settings /></ProtectedRoute>
  } />
  <Route path="/ops/settings" element={
    <ProtectedRoute allowedRoles={["admin","office_manager"]}><OpsSettings /></ProtectedRoute>
  } />
</Route>

<Route path="*" element={<NotFound />} />
```

### 4. `src/index.css`

- Remove the `.ops-theme` block (lines 78-88). No longer needed since there is no separate OpsLayout wrapping content in that class.

### 5. `src/pages/Login.tsx`

- Line 15: Change default redirect from `"/"` to `"/dashboard"`
- Line 108 area: Change "Roof Group" brand text to "RoofMind"

---

## What Does NOT Change

- `AppLayout.tsx`, `AppSidebar.tsx`, `OpsLayout.tsx`, `OpsSidebar.tsx` -- left untouched (become unused, cleanup later)
- `index.html` -- no branding sweep
- All page content, data fetching, Supabase queries
- `ProtectedRoute`, `useAuth`, `NotificationBell` -- all unchanged
- `FieldTodayView`, `ScheduleUpload`, all ops pages -- zero changes
- No database or RLS changes
