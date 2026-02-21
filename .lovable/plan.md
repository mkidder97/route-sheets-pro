

# Audit Log Table and Edge Function Logging

## 1. Database Migration

Create a new migration with the following SQL:

```sql
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_ops_role(auth.uid(), 'admin'::ops_role));

CREATE POLICY "Authenticated insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
```

- Only admins can read the audit log
- Any authenticated user can insert (the edge function uses `supabaseAdmin` which bypasses RLS, but this policy covers future use from client-side if needed)
- No UPDATE or DELETE allowed -- audit log is append-only

## 2. Edge Function Changes (`supabase/functions/manage-users/index.ts`)

Add audit log inserts after each successful action. No other logic changes.

### Helper function (add near the top, after the `json` function):

```ts
async function logAudit(
  supabaseAdmin: any,
  userId: string,
  action: string,
  targetId: string,
  details: Record<string, unknown> = {}
) {
  await supabaseAdmin.from("audit_log").insert({
    user_id: userId,
    action,
    target_table: "user_profiles",
    target_id: targetId,
    details,
  });
}
```

### Insert audit calls at 4 locations:

**After successful `create` (line ~157, before the return):**
```ts
await logAudit(supabaseAdmin, user.id, "create_user", newUser.user.id, {
  email, role, full_name,
});
```

**After successful `update` (line ~183, before the return):**
```ts
await logAudit(supabaseAdmin, user.id, "update_user", user_id, {
  ...profileUpdates,
  ...(role ? { role } : {}),
});
```

**After successful `activate` (line ~196, before the return):**
```ts
await logAudit(supabaseAdmin, user.id, "activate_user", user_id, {});
```

**After successful `deactivate` (line ~209, before the return):**
```ts
await logAudit(supabaseAdmin, user.id, "deactivate_user", user_id, {});
```

### Summary of edge function changes:
- Add `logAudit` helper function
- 4 new `await logAudit(...)` calls, one per admin action
- No other logic changes

