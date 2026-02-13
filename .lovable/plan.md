

# Simplify Roles: Remove "Inspector" and "Construction Manager", Add "Field Ops"

## What's Changing

You want two things:
1. **Merge "Inspector" and "Construction Manager" into a single role** -- since employees often do both. We'll call it **"field_ops"** (displayed as "Field Ops").
2. **No dual-role support needed** -- since you're the admin and also do field work, we'll just keep you as "admin" and let admins always have the option to link to an inspector profile. That way you don't need two roles on one account.

## Changes

### 1. Database migration

- Add `field_ops` to the `ops_role` enum
- Remove `inspector` and `construction_manager` from the enum (after migrating any existing rows)
- Update the `get_ops_role` and `has_ops_role` functions accordingly (they work off the enum, so they'll automatically support the new value)

```text
Migration steps:
1. UPDATE user_roles SET role = 'field_ops' WHERE role IN ('inspector', 'construction_manager')
2. ALTER TYPE ops_role ADD VALUE 'field_ops'
3. (Postgres can't remove enum values, so we recreate the type)
   - Rename old enum, create new one with: admin, office_manager, field_ops, engineer
   - Alter column to use new enum
   - Drop old enum
```

We keep **"engineer"** since that's a distinct role. If you want to remove it too, let me know.

### 2. Edge function (`supabase/functions/manage-users/index.ts`)

- Update `VALID_ROLES` array: replace `inspector` and `construction_manager` with `field_ops`

### 3. Settings page (`src/pages/ops/OpsSettings.tsx`)

- Update `ROLE_OPTIONS`: remove Inspector and Construction Manager, add "Field Ops"
- Show the "Link to Inspector" dropdown for **both** `field_ops` and `admin` roles (so you as admin can link yourself to an inspector profile)

### 4. Sidebar (`src/components/ops/OpsSidebar.tsx`)

- Update `roleLabels` map: remove old roles, add `field_ops: "Field Ops"`

### 5. Auth types (`src/hooks/useAuth.tsx`, `src/components/ops/ProtectedRoute.tsx`)

- Update the `OpsRole` type to: `"admin" | "office_manager" | "field_ops" | "engineer"`

### 6. Anywhere referencing `inspector` role for conditional logic

- The inspector link dropdown condition changes from `role === "inspector"` to `role === "field_ops" || role === "admin"`

## Files Modified

| File | Change |
|------|--------|
| New migration SQL | Recreate enum with 4 values, migrate existing data |
| `supabase/functions/manage-users/index.ts` | Update VALID_ROLES |
| `src/pages/ops/OpsSettings.tsx` | Update ROLE_OPTIONS and inspector-link conditions |
| `src/components/ops/OpsSidebar.tsx` | Update roleLabels |
| `src/hooks/useAuth.tsx` | Update OpsRole type |
| `src/components/ops/ProtectedRoute.tsx` | Update OpsRole type |

## Technical Details

| Item | Detail |
|------|--------|
| Files modified | 5 + 1 migration |
| New roles | `field_ops` replaces `inspector` + `construction_manager` |
| Kept roles | `admin`, `office_manager`, `engineer`, `field_ops` |
| Inspector link shown for | `admin` and `field_ops` roles |
| Enum migration | Recreate enum (Postgres can't drop values from an existing enum) |

