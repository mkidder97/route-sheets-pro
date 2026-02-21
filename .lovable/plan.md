

# Security Lockdown and Site-Wide Login

## Overview

This change closes the open-access security gap on all RoofRoute tables and consolidates login into a single `/login` page used by both RoofRoute and RoofOps sides of the app.

---

## 1. Database Migration -- Lock Down 8 Tables

A single migration will drop all "Public *" RLS policies on these tables and replace them with "Authenticated *" policies (requiring a valid session):

| Table | Policies Replaced |
|---|---|
| clients | read, insert, update |
| regions | read, insert, update |
| inspectors | read, insert, update |
| uploads | read, insert, update |
| buildings | read, insert, update, delete |
| route_plans | read, insert, update, delete |
| route_plan_days | read, insert, update, delete |
| route_plan_buildings | read, insert, update, delete |

Also drops remaining "Public delete" policies on clients, regions, inspectors (if they exist) to be thorough. No RoofOps tables are touched.

---

## 2. New File: `src/pages/Login.tsx`

A copy of `OpsLogin.tsx` with these changes:

- **Icon**: `Building2` instead of `Kanban`
- **Header text**: "Roof Group" instead of "RoofOps"
- **Subtitle**: "Sign in to continue"
- **Redirect after login**: Uses `useLocation` to read `location.state?.from?.pathname`, defaulting to `"/"`. This sends users back to the page they were trying to reach.
- **Bootstrap flow**: Kept as-is (first-time admin setup)

---

## 3. Modified: `src/components/ops/ProtectedRoute.tsx`

- Import `useLocation` from react-router-dom
- Change redirect from `/ops/login` to `/login`
- Pass `state={{ from: location }}` so the Login page knows where to redirect back

---

## 4. Modified: `src/App.tsx`

- Import `Login` from `./pages/Login` and `Navigate` from react-router-dom
- Remove `OpsLogin` import
- Add `/login` route (public)
- Add `/ops/login` legacy redirect to `/login`
- Wrap RoofRoute routes in `ProtectedRoute`

```text
/login              --> Login (public)
/ops/login          --> redirect to /login
/                   --> ProtectedRoute > AppLayout > MyRoutes
/my-routes          --> ProtectedRoute > AppLayout > MyRoutes
/route-builder      --> ProtectedRoute > AppLayout > RouteBuilder
/buildings          --> ProtectedRoute > AppLayout > DataManager
/settings           --> ProtectedRoute > AppLayout > Settings
/ops/*              --> ProtectedRoute > OpsLayout (unchanged)
```

---

## 5. Modified: `src/components/AppSidebar.tsx`

Add to the bottom section:
- Import `useAuth` and `LogOut` icon
- Show `profile?.full_name` when sidebar is expanded
- Add "Sign Out" button that calls `signOut()`

---

## 6. Delete: `src/pages/ops/OpsLogin.tsx`

Replaced by `src/pages/Login.tsx`. The `/ops/login` route redirects to `/login`.

---

## Files Changed Summary

| File | Action |
|---|---|
| `supabase/migrations/...` | New -- drop public policies, create authenticated policies |
| `src/pages/Login.tsx` | New -- site-wide login page |
| `src/components/ops/ProtectedRoute.tsx` | Edit -- redirect to /login with location state |
| `src/App.tsx` | Edit -- protect RoofRoute routes, add /login, remove OpsLogin |
| `src/components/AppSidebar.tsx` | Edit -- add user name + sign out |
| `src/pages/ops/OpsLogin.tsx` | Delete |

