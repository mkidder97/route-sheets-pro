

# Bootstrap Token Protection

## Overview
Protect the `check-setup` and `bootstrap` actions in the `manage-users` edge function with an optional `BOOTSTRAP_TOKEN` secret, and add a corresponding token input to the Login page's setup form.

## 1. Edge Function (`supabase/functions/manage-users/index.ts`)

### Read token at top of handler (after parsing JSON, ~line 59)
```ts
const BOOTSTRAP_TOKEN = Deno.env.get("BOOTSTRAP_TOKEN") || "";
```

### Add token validation for `check-setup` (lines 61-67)
Before the existing logic, check `payload.setup_token`:
```ts
if (action === "check-setup") {
  if (BOOTSTRAP_TOKEN && payload.setup_token !== BOOTSTRAP_TOKEN) {
    return json(req, { error: "Invalid setup token" }, 403);
  }
  // ... existing count check ...
}
```

### Add token validation for `bootstrap` (lines 69-76)
Same pattern, before the existing "already has users" check:
```ts
if (action === "bootstrap") {
  if (BOOTSTRAP_TOKEN && payload.setup_token !== BOOTSTRAP_TOKEN) {
    return json(req, { error: "Invalid setup token" }, 403);
  }
  // ... existing logic ...
}
```

If `BOOTSTRAP_TOKEN` is empty/unset, the check is skipped (local dev friendly).

## 2. Login Page (`src/pages/Login.tsx`)

### Add state variable (~line 35)
```ts
const [setupToken, setSetupToken] = useState("");
```

### Include `setup_token` in both calls

**check-setup call (~line 40):** Add `setup_token: setupToken` to the body. Since the token state starts empty and `check-setup` runs on mount, this means the check-setup call will only succeed without a token if `BOOTSTRAP_TOKEN` is unset. This is the intended behavior -- if a token is configured, the "Set up first admin account" link won't appear unless the user provides the token first. Alternatively, we can skip sending the token on check-setup and only gate bootstrap itself.

Actually, a simpler UX: keep `check-setup` gated but always show the setup link if `needsSetup` would be true. Instead, gate only the `bootstrap` action. Let me reconsider...

**Revised approach:** Only gate `bootstrap`, not `check-setup`. This way the "Set up first admin account" link appears normally, and the token is required only when submitting the bootstrap form.

- `check-setup`: No token required (knowing whether setup is needed is not sensitive)
- `bootstrap`: Token required if `BOOTSTRAP_TOKEN` env var is set

### Add token input to bootstrap form (~after password field, line 168)
```tsx
<div className="space-y-2">
  <Label htmlFor="setup-token">Setup Token</Label>
  <Input
    id="setup-token"
    type="password"
    placeholder="Provided by your administrator"
    value={setupToken}
    onChange={(e) => setSetupToken(e.target.value)}
  />
</div>
```

### Include token in bootstrap payload (~line 86)
Add `setup_token: setupToken` to the body object sent to `manage-users`.

## 3. Add `BOOTSTRAP_TOKEN` Secret
Use the secrets tool to prompt you to set a `BOOTSTRAP_TOKEN` value. This is a one-time setup secret you choose.

## Summary of changes
- **Edge function**: Add `BOOTSTRAP_TOKEN` env read + validation guard on `bootstrap` action only
- **Login page**: Add `setupToken` state, a password input in the setup form, and include it in the bootstrap request payload
- **Secret**: Add `BOOTSTRAP_TOKEN` via secrets tool
- No other logic changes
