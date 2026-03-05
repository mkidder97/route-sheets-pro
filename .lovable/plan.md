

## Disable Bootstrap Endpoint After First Use

### Changes

**1. Database migration — create `system_settings` table**

```sql
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
ON public.system_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

INSERT INTO public.system_settings (key, value)
VALUES ('bootstrap_completed', 'false')
ON CONFLICT (key) DO NOTHING;
```

RLS locks the table to service_role only — no client-side access.

**2. Edge function edit — `supabase/functions/manage-users/index.ts`**

In the `bootstrap` action (lines 145-171), add a `system_settings` check after the existing user count check (after line 151), and set the flag after successful admin creation (before line 170).

Before (lines 149-170):
```ts
if ((count ?? 0) > 0) {
  return json(req, { error: "System already has users. Bootstrap is disabled." }, 403);
}
// ... create user, insert role ...
return json(req, { success: true, user_id: newUser.user.id });
```

After:
```ts
if ((count ?? 0) > 0) {
  return json(req, { error: "System already has users. Bootstrap is disabled." }, 403);
}

const { data: setting } = await supabaseAdmin
  .from("system_settings")
  .select("value")
  .eq("key", "bootstrap_completed")
  .single();
if (setting?.value === "true") {
  return json(req, { error: "Bootstrap already completed." }, 403);
}

// ... existing create user + insert role code ...

await supabaseAdmin
  .from("system_settings")
  .update({ value: "true", updated_at: new Date().toISOString() })
  .eq("key", "bootstrap_completed");

return json(req, { success: true, user_id: newUser.user.id });
```

### Files Modified
- `supabase/functions/manage-users/index.ts` — bootstrap action only
- New migration — `system_settings` table + seed row

### Not Changed
- `check-setup` action
- All other actions in the edge function
- Login page or any application code

