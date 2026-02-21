

# In-Memory Rate Limiting for manage-users Edge Function

## Overview
Add simple per-IP rate limiting (30 requests/minute) to `supabase/functions/manage-users/index.ts` with automatic cleanup of expired entries.

## Changes (single file: `supabase/functions/manage-users/index.ts`)

### 1. Rate limit map (after imports, before ALLOWED_ORIGINS)
- Add a `Map<string, { count: number; resetTime: number }>` at module level
- Define constants: `RATE_LIMIT = 30`, `RATE_WINDOW = 60_000` (1 minute in ms)

### 2. Rate limit check function
A helper that:
- Extracts IP from `x-forwarded-for` (first entry) or `cf-connecting-ip` or `"unknown"`
- Iterates the map and deletes entries where `Date.now() > resetTime` (cleanup)
- Looks up or creates the entry for the current IP
- If expired, resets count to 1 and resetTime to now + 60s
- If count exceeds 30, returns a 429 response with `Retry-After: 60` header
- Otherwise increments count and returns `null` (proceed)

### 3. Integration point (after OPTIONS check, before `req.json()`)
Insert the rate limit check. If it returns a response, return it immediately. This is around line 85 in the current file, right after the OPTIONS handler block.

### No other changes
- No new dependencies
- No changes to validation, CORS, auth, audit, or action logic

## Technical Detail

```text
Location in file:

  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") { ... }    // existing

    // >>> INSERT rate limit check here <<<

    try {
      const supabaseUrl = ...                // existing
```

The 429 response will include CORS headers (using `getCorsHeaders`) so the browser can read the error, plus `Retry-After: 60`.

