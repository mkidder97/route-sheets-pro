

## Campaign Kickoff PM Notification — Edge Function + DB Trigger

### What This Does
When an inspection campaign's status changes to `active`, a database trigger fires an HTTP call to a new edge function. The edge function queries all buildings in the campaign's region, deduplicates property managers by email, and sends the full contact list to a Make.com webhook for email dispatch.

### Changes

**1. New Edge Function: `supabase/functions/campaign-kickoff-notify/index.ts`**
- Receives `campaign_id`, `region_id`, `name`, `start_date` from the trigger payload
- Uses service role client to query `buildings` in the region where `property_manager_email` is not null
- Deduplicates by email, grouping `property_name` arrays per PM
- POSTs the clean payload (`campaign_id`, `campaign_name`, `start_date`, `contacts[]`) to the Make webhook
- Returns success with `contacts_notified` count
- No CORS headers needed (not called from browser)

**2. Config update: `supabase/config.toml`**
- Add `[functions.campaign-kickoff-notify]` with `verify_jwt = false` (called from DB trigger, not browser)

**3. SQL Migration**
- Enable `pg_net` extension for outbound HTTP from triggers
- Create `notify_campaign_kickoff()` function (SECURITY DEFINER) that fires `net.http_post` to the edge function when `status` transitions to `active`
- Create `campaign_kickoff_webhook` trigger on `inspection_campaigns` AFTER UPDATE

**Important note on `pg_net` and `current_setting`**: The `current_setting('app.supabase_url')` and `current_setting('app.service_role_key')` approach requires these Postgres config vars to be set. In Lovable Cloud, these may not be available as `app.*` settings. The migration will instead use `net.http_post` with the actual Supabase URL constructed from the project ref, and pass the service role key from a vault secret or use the edge function's `verify_jwt = false` setting to skip auth entirely (since the trigger is server-side and trusted).

Revised SQL approach: Since `verify_jwt = false` means the edge function accepts unauthenticated calls, the trigger can call it without an Authorization header. The URL will be hardcoded using the known project URL.

### Files
- **New:** `supabase/functions/campaign-kickoff-notify/index.ts`
- **Modified:** `supabase/config.toml` (add function entry)
- **New migration:** SQL for `pg_net`, trigger function, and trigger

### No React/UI changes.

