

# Campaign Detail: Status Updates, Bulk Actions, and Comments

## Overview

Add three capabilities to the Campaign Detail page:
1. Inline status dropdown per building row (admin/office_manager only)
2. Bulk actions via checkboxes and a floating action bar
3. A comments section backed by a new `comments` table

**Note on master buildings sync**: Status updates will sync to the master `buildings` table as a "last known status" convenience. The `campaign_buildings` snapshot remains the source of truth per-campaign. This is acceptable for now since overlapping campaigns on the same buildings are not yet common.

---

## 1. Database Migration

### Create `comments` table

| Column | Type | Details |
|--------|------|---------|
| id | uuid | PK, gen_random_uuid() |
| user_id | uuid | NOT NULL, FK to auth.users(id) ON DELETE CASCADE |
| entity_type | text | NOT NULL |
| entity_id | uuid | NOT NULL |
| content | text | NOT NULL |
| created_at | timestamptz | DEFAULT now() |

- Index on (entity_type, entity_id) for efficient lookups
- RLS: SELECT for authenticated users, INSERT with check `auth.uid() = user_id`

### Add validation trigger on `campaign_buildings`

Replace the existing CHECK constraint on `inspection_status` with a validation trigger (consistent with the existing `validate_inspection_status` function pattern), to avoid immutability issues.

---

## 2. Update `src/pages/ops/OpsCampaignDetail.tsx`

### A) Inline Status Dropdown (admin/office_manager only)

- In the Status column, replace the read-only Badge with a Select dropdown when `canEdit` is true
- Use `e.stopPropagation()` on the Select to prevent row expansion
- On status change, call `updateBuildingStatus()` which:
  1. Updates `campaign_buildings.inspection_status` (and sets `completion_date` to today if status is `complete`, clears it otherwise)
  2. Syncs the master `buildings.inspection_status` as a convenience write
  3. Recalculates `completed_buildings` count on the campaign by counting `campaign_buildings` where status is `complete`
  4. Inserts into `activity_log` with action `status_change`, entity_type `building`, entity_id the building UUID, and details containing old/new status and campaign_id
  5. Updates local state optimistically and shows a success toast
- Read-only Badge remains for non-edit roles

### B) Bulk Actions

**Selection state:**
- New `selectedIds` state as `Set<string>` tracking campaign_building IDs
- Checkbox column added as the first column (before the expand chevron)
- Header checkbox toggles select-all for currently filtered rows
- Individual row checkboxes toggle selection; `e.stopPropagation()` prevents row expand

**Floating action bar:**
- Renders as a fixed-position bar at the bottom when `selectedIds.size > 0`
- Shows count label ("X selected")
- "Update Status" button with a Select dropdown (5 status options) -- on selection, loops through all selected rows and applies the same logic as inline status update, with a single campaign count recalculation at the end
- "Reassign Inspector" button with a Select dropdown populated from the inspectors list -- updates `inspector_id` on selected `campaign_buildings` rows and logs activity for each
- "Clear" button to deselect all
- After bulk action: clear selection, re-fetch buildings, show success toast

### C) Comments Section

- New section below the buildings table with "Comments" heading
- Fetches from `comments` where `entity_type = 'campaign'` and `entity_id = campaign.id`
- Joins `user_profiles` on `user_id` for `full_name`
- Each comment displays: author name (bold), relative time via `formatDistanceToNow` from date-fns, and content
- Text input + "Post" button at the bottom
- On submit: inserts with `user_id` from `useAuth().user.id`, refreshes list
- Empty state message when no comments exist

---

## New imports needed

- `Checkbox` from `@/components/ui/checkbox`
- `Textarea` from `@/components/ui/textarea`
- `formatDistanceToNow` from `date-fns`
- `MessageSquare` from `lucide-react` (for comments heading icon)

---

## Files

| File | Action |
|------|--------|
| New migration SQL | Create `comments` table with indexes and RLS |
| `src/pages/ops/OpsCampaignDetail.tsx` | Add inline status dropdown, bulk actions with floating bar, comments section |

## Technical Details

| Item | Detail |
|------|--------|
| New table | `comments` with authenticated read/insert RLS |
| Status update flow | campaign_buildings then buildings then recount then activity_log then toast |
| Bulk updates | Per-row loop for activity logging, single recount at end |
| Comments join | `user_profiles` for `full_name` display |
| Role gating | `canEdit` (admin/office_manager) controls status dropdown, checkboxes, and bulk bar |
| Event propagation | `stopPropagation` on Select and Checkbox clicks to prevent row expand |
| Master sync caveat | Documented as "last known status" -- campaign_buildings is source of truth |

