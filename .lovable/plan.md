

# Admin User Management for RoofOps

## The Problem

There's no sign-up form (by design), so there's no way to create the first user or any subsequent users. Admins need to manage employee accounts from within the app.

## Solution: Two-Part Approach

### Part 1: Backend Function to Create Users

Create a backend function (`manage-users`) that uses the admin API to create auth accounts and assign roles. It will support:

- **Create user**: Takes email, password, full_name, role, and optional inspector_id. Creates the auth user, then inserts a role into `user_roles`.
- **List users**: Returns all user profiles with their roles (admin-only).
- **Deactivate user**: Sets `is_active = false` on a profile (admin-only).

The function verifies the calling user is an admin before executing any action. For the **first-ever call** (when zero users exist in `user_roles`), it allows creating the initial admin without authentication -- this is a one-time bootstrap that only works when the system is completely empty.

### Part 2: Admin UI in OpsSettings

Build a "User Management" tab in the OpsSettings page (visible only to admins) with:

- A table listing all users: name, email, role, active status
- An "Add User" button that opens a dialog/form with fields for:
  - Full Name
  - Email
  - Temporary Password
  - Role (dropdown: Admin, Office Manager, Inspector, Engineer, Construction Manager)
  - Inspector Link (optional dropdown, populated from the inspectors table)
- A deactivate button on each user row

### Part 3: Bootstrap Flow

When you first visit `/ops/login`, you'll see the normal login form. Since no accounts exist yet, we add a small "Set up first admin" link below the sign-in button that only appears when zero users exist. It shows a simple form (name, email, password) and calls the backend function's bootstrap endpoint. Once the first admin is created, this link disappears permanently.

## New Files

### `supabase/functions/manage-users/index.ts`

Backend function with three actions:

| Action | Auth Required | Description |
|--------|--------------|-------------|
| `bootstrap` | None (only works when 0 users in user_roles) | Creates first admin account |
| `create` | Admin only | Creates a new user with role |
| `list` | Admin only | Returns all profiles + roles |
| `deactivate` | Admin only | Sets is_active = false |

For `create` and `bootstrap`:
1. Call `supabase.auth.admin.createUser()` with email, password, and `email_confirm: true` (so the user can log in immediately)
2. Insert a row into `user_roles` with the chosen role
3. The existing `handle_new_user` trigger auto-creates the `user_profiles` row

### `src/pages/ops/OpsSettings.tsx` (rewrite)

Transforms the stub into a tabbed settings page:
- **User Management tab** (admin-only): user table + add user dialog
- **General tab**: placeholder for future settings

### `src/pages/ops/OpsLogin.tsx` (modify)

Add a "First-time setup" link that:
- Only shows when a quick check confirms zero users exist (calls `manage-users` with action `check-setup`)
- Opens inline fields for name, email, password
- Calls the bootstrap endpoint
- On success, logs the user in automatically

## Modified Files

| File | Change |
|------|--------|
| `supabase/functions/manage-users/index.ts` | New -- backend function for user CRUD |
| `src/pages/ops/OpsSettings.tsx` | Rewrite -- add user management UI |
| `src/pages/ops/OpsLogin.tsx` | Add bootstrap setup flow for first admin |

## Technical Details

| Item | Detail |
|------|--------|
| New files | 1 backend function |
| Modified files | 2 (OpsSettings, OpsLogin) |
| Admin API | `supabase.auth.admin.createUser()` via service role key |
| Bootstrap security | Only works when `user_roles` table has zero rows |
| Email confirmation | Skipped (`email_confirm: true`) since admins create accounts |
| Role assignment | Inserted into `user_roles` table, not on profile |

