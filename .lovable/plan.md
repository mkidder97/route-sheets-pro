
# Role-Based RLS Migration

## Overview
Replace the blanket "Authenticated insert/update/delete" policies on 9 core tables with role-based policies using the existing `has_ops_role()` security definer function. SELECT policies stay unchanged.

## Current State
All 9 tables have simple `true` policies for authenticated users on INSERT, UPDATE, and DELETE (where applicable). No role checking is performed.

## Migration Details

A single SQL migration that, for each table:
1. **Keeps** the existing "Authenticated read" SELECT policy (no change)
2. **Drops** "Authenticated insert" and creates "Role insert [table]" -- admin + office_manager only
3. **Drops** "Authenticated update" and creates "Role update [table]" -- admin + office_manager + field_ops
4. **Drops** "Authenticated delete" (if exists) and creates "Admin delete [table]" -- admin only
5. For tables without an existing delete policy (clients, regions, inspectors, uploads), adds the new admin-only delete policy

### Exception: route_plans, route_plan_days, route_plan_buildings
These three tables also allow `field_ops` to INSERT (inspectors create route plans), so their INSERT policy includes three roles instead of two.

### Tables and their changes:

| Table | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|
| clients | admin, office_manager | admin, office_manager, field_ops | admin (new) |
| regions | admin, office_manager | admin, office_manager, field_ops | admin (new) |
| inspectors | admin, office_manager | admin, office_manager, field_ops | admin (new) |
| buildings | admin, office_manager | admin, office_manager, field_ops | admin (replace) |
| uploads | admin, office_manager | admin, office_manager, field_ops | admin (new) |
| generated_documents | admin, office_manager | admin, office_manager, field_ops | admin (replace) |
| route_plans | admin, office_manager, field_ops | admin, office_manager, field_ops | admin (replace) |
| route_plan_days | admin, office_manager, field_ops | admin, office_manager, field_ops | admin (replace) |
| route_plan_buildings | admin, office_manager, field_ops | admin, office_manager, field_ops | admin (replace) |

### SQL Pattern (example for `clients`):
```sql
-- INSERT: admin + office_manager
DROP POLICY IF EXISTS "Authenticated insert clients" ON public.clients;
CREATE POLICY "Role insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
  );

-- UPDATE: admin + office_manager + field_ops
DROP POLICY IF EXISTS "Authenticated update clients" ON public.clients;
CREATE POLICY "Role update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin'::ops_role)
    OR public.has_ops_role(auth.uid(), 'office_manager'::ops_role)
    OR public.has_ops_role(auth.uid(), 'field_ops'::ops_role)
  );

-- DELETE: admin only
CREATE POLICY "Admin delete clients" ON public.clients
  FOR DELETE TO authenticated
  USING (public.has_ops_role(auth.uid(), 'admin'::ops_role));
```

### No code changes required
This is a database-only change. The frontend code does not reference policy names and will continue to work -- users without the required role will simply get permission errors from the database when attempting restricted operations.

## Security Notes
- The `has_ops_role` function is `SECURITY DEFINER`, so it bypasses RLS on `user_roles` and avoids infinite recursion
- SELECT remains open to all authenticated users (read access is universal)
- Only admins can delete from any table
- field_ops can update all tables (needed for inspection workflow) but can only insert into route plan tables
