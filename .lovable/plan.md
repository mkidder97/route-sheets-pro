
# Fix CORS Wildcard on Edge Function

## Overview
Replace the hardcoded `Access-Control-Allow-Origin: "*"` in `manage-users/index.ts` with dynamic origin validation using an `ALLOWED_ORIGINS` environment variable.

## Changes (single file: `supabase/functions/manage-users/index.ts`)

### 1. Replace the static `corsHeaders` object (lines 3-7) with:

```ts
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}
```

### 2. Update `json()` helper (line 18-23)
Change it to accept `req` so it can pass it to `getCorsHeaders`:

```ts
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}
```

### 3. Update OPTIONS handler (line 42-44)
```ts
if (req.method === "OPTIONS") {
  return new Response(null, { headers: getCorsHeaders(req) });
}
```

### 4. Update all `json(...)` calls
Every call to `json(body, status)` becomes `json(req, body, status)`. There are ~20 call sites throughout the file. No logic changes -- just prepending `req` as the first argument.

### 5. Add `ALLOWED_ORIGINS` secret
Use the secrets tool to prompt you to set the `ALLOWED_ORIGINS` environment variable with a comma-separated list of your app's origins (e.g., `https://roofwise-inspector-routes.lovable.app,https://id-preview--27bf5129-0fea-468f-aae0-231df2a2ffd5.lovable.app`).

## No other logic changes
All business logic, audit logging, role checks, and action handlers remain identical.
