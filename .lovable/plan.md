

# CM Project Detail — Inspector Dropdown Correction

## The Issue
The user flagged that the plan's inspector dropdown query was wrong. After investigation, here's the actual situation:

- `user_profiles` does **not** have a `role` column (confirmed from types.ts — columns are: id, email, full_name, phone, inspector_id, is_active, notification_preferences, created_at, updated_at)
- `user_roles` **does** exist as a separate table with columns: id, user_id, role (ops_role enum)
- The original plan was actually correct to use `user_roles` — but the user's proposed query (`user_profiles.in('role', [...])`) would fail because there is no `role` column on `user_profiles`

## Correct Approach
Query `user_roles` to get user_ids with role `inspector` or `construction_manager`, then fetch their profiles from `user_profiles`. This matches how the codebase already works (e.g., `CMJobsBoard.tsx` line 588 queries `user_roles`).

Two-step query:
1. `supabase.from("user_roles").select("user_id").in("role", ["inspector", "construction_manager"])` → get user IDs
2. `supabase.from("user_profiles").select("id, full_name").in("id", userIds).eq("is_active", true).order("full_name")` → get display names

Alternatively, a single query if foreign key relationship exists — but `user_roles.Relationships` is empty in the types, so two queries is safer.

## Everything Else Unchanged
The rest of the plan (page header, visits tab, project info tab, routing, file deletion) remains exactly as previously approved. Only the inspector dropdown data fetching changes.

## Summary of Files
1. **Created**: `src/pages/cm/CMProjectDetail.tsx` — with corrected two-step inspector query
2. **Modified**: `src/App.tsx` — add `/cm/:projectId` route, update import
3. **Deleted**: `src/pages/field/cm/CMProjectDetail.tsx` — old placeholder

