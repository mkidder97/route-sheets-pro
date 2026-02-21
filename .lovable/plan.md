

# Add Content-Security-Policy Header to vercel.json

## Overview
Add a `Content-Security-Policy` header to the existing headers array in `vercel.json`. No other headers are changed.

## Change

In `vercel.json`, append one new entry to the `headers` array inside the `"source": "/(.*)"` block:

```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
}
```

## What it does
- **default-src 'self'**: Only allow resources from the same origin by default
- **script-src 'self'**: Only allow scripts from the same origin
- **style-src 'self' 'unsafe-inline'**: Allow styles from same origin plus inline styles (needed for Tailwind/runtime CSS)
- **img-src 'self' data: https:**: Allow images from same origin, data URIs, and any HTTPS source
- **font-src 'self' data:**: Allow fonts from same origin and data URIs
- **connect-src 'self' https://*.supabase.co wss://*.supabase.co**: Allow API/WebSocket connections to same origin and backend
- **frame-ancestors 'none'**: Prevent the app from being embedded in iframes (complements existing X-Frame-Options: DENY)
- **base-uri 'self'**: Prevent base tag hijacking
- **form-action 'self'**: Restrict form submissions to same origin

## File modified
- `vercel.json` (one new header entry appended)

