

# Enhanced RoofOps Settings Page

## Overview

The OpsSettings page already has a basic user management table and add-user dialog. This plan enhances it to match the full requirements: role filtering, linked inspector column, edit dialog, toggle active/inactive, phone field, and route-level role restriction. The edge function also needs new actions for `update` and `activate`.

## Changes

### 1. Route restriction in `src/App.tsx`

Wrap the `/ops/settings` route with its own `ProtectedRoute` using `allowedRoles`:

```text
<Route path="settings" element={
  <ProtectedRoute allowedRoles={["admin", "office_manager"]}>
    <OpsSettings />
  </ProtectedRoute>
} />
```

### 2. Edge function updates (`supabase/functions/manage-users/index.ts`)

Add two new actions (admin-only):

- **`update`**: Accepts `user_id`, and optional `full_name`, `phone`, `role`, `inspector_id`. Updates `user_profiles` fields and, if role changed, upserts `user_roles`.
- **`activate`**: Sets `is_active = true` on a user profile (inverse of existing `deactivate`).

Also update the `list` action to include `inspector_id` in the response (already does) and join inspector names from the `inspectors` table for display.

### 3. Full rewrite of `src/pages/ops/OpsSettings.tsx`

**User table enhancements:**
- Add "Linked Inspector" column showing inspector name (resolved from the inspectors list)
- Add role filter dropdown above the table
- Sort users by name alphabetically
- Clicking a row opens an Edit User dialog
- Replace the deactivate-only icon with a toggle Switch for is_active

**Add User dialog enhancements:**
- Add optional Phone input field
- Only show "Link to Inspector" dropdown when selected role is `inspector`
- Pass phone to the edge function

**New Edit User dialog:**
- Pre-populated fields for Full Name, Phone, Role, Inspector Link
- Email shown as read-only text (not editable)
- On submit, calls edge function with action `update`
- Inspector dropdown only shown when role is `inspector`

### 4. Allow office_manager access to user list

Update the edge function's admin check for `list` action to also allow `office_manager` role. The `create`, `update`, `deactivate`, `activate` actions remain admin-only.

## Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Wrap settings route with `allowedRoles` |
| `supabase/functions/manage-users/index.ts` | Add `update` and `activate` actions; allow office_manager for `list` |
| `src/pages/ops/OpsSettings.tsx` | Full rewrite with filtering, sorting, edit dialog, toggle, phone field |

## Technical Details

| Item | Detail |
|------|--------|
| Modified files | 3 |
| New files | 0 |
| Edge function actions added | 2 (`update`, `activate`) |
| Role restriction | `allowedRoles={["admin", "office_manager"]}` on the route |
| UI components used | Table, Dialog, Select, Switch, Badge, Input, Button (all existing) |

