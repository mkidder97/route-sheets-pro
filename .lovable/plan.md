

# Fix Role Enum and Edge Function

## Current State
- The `ops_role` enum already contains `field_ops` (along with `admin`, `office_manager`, `engineer`)
- It is **missing** `inspector` and `construction_manager`
- The edge function `VALID_ROLES` array has 4 entries and needs to be updated to 6

## Changes

### 1. Database Migration
Add the two missing values to the `ops_role` enum:

```sql
ALTER TYPE public.ops_role ADD VALUE IF NOT EXISTS 'inspector';
ALTER TYPE public.ops_role ADD VALUE IF NOT EXISTS 'construction_manager';
```

No need to add `field_ops` — it already exists.

### 2. Edge Function Update (`supabase/functions/manage-users/index.ts`)
Update lines 9-14 to expand `VALID_ROLES`:

```ts
const VALID_ROLES = [
  "admin",
  "office_manager",
  "field_ops",
  "engineer",
  "inspector",
  "construction_manager",
];
```

No other logic in the edge function changes.

### 3. Dependent Code
The `has_ops_role` and `get_ops_role` database functions already work with the `ops_role` enum generically, so they will automatically support the new values. The `useAuth` hook's `OpsRole` type in `src/hooks/useAuth.tsx` should be updated to include the new roles:

```ts
type OpsRole = "admin" | "office_manager" | "field_ops" | "engineer" | "inspector" | "construction_manager";
```

