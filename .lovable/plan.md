

# Input Validation for manage-users Edge Function

## Overview
Add server-side input validation to all actions in `supabase/functions/manage-users/index.ts` using simple regex checks. No new dependencies.

## Validation Helpers (add after `logAudit`, before `Deno.serve`)

Three small helper functions:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^[\d\s\-()+]+$/;

function validateEmail(email: unknown): string | null { ... }
function validatePassword(password: unknown): string | null { ... }
function validateFullName(full_name: unknown): string | null { ... }
function validatePhone(phone: unknown): string | null { ... }
function validateUuid(user_id: unknown): string | null { ... }
```

Each returns `null` if valid, or an error message string if invalid.

## Per-Action Validation

### `bootstrap` (line 78-81)
After destructuring `email, password, full_name`, replace the simple truthy check with calls to the validators. Return 400 with the first error found.

### `create` (line 151-157)
After destructuring, validate `email`, `password`, `full_name` with the same helpers. Validate `phone` if provided. The existing `VALID_ROLES` check stays as-is.

### `update` (line 191-192)
- Validate `user_id` is a valid UUID (replaces the simple `!user_id` check)
- If `full_name` is provided, validate it (non-empty, under 200 chars)
- If `phone` is provided, validate it
- If `role` is provided, validate it is in `VALID_ROLES` -- currently the code silently ignores an invalid role; change to return 400

### `activate` (line 222-223)
Validate `user_id` is a valid UUID.

### `deactivate` (line 237-238)
Validate `user_id` is a valid UUID.

## No Other Changes
- No new dependencies
- No changes to CORS, auth, audit logging, or any other logic
- Only file modified: `supabase/functions/manage-users/index.ts`
