

# Handoff Notifications and "Your Turn" Visual Indicator

## Overview

Enhance the shared `changeJobStatus` function to detect role handoffs between pipeline stages and send targeted notifications. Add a "Your Turn" visual indicator on job cards when the current user's role matches the status column's `owner_role`.

---

## 1. Enhanced `changeJobStatus` Function

### Current behavior (lines 452-495)
The function updates the status, inserts history, logs activity, and shows a toast. No notifications are sent.

### New behavior
After the DB update succeeds, before the toast:

1. Look up old and new `StatusDef` from `sortedStatuses` to get their `owner_role`
2. Find the job in the local `jobs` array to get `created_by` and `assigned_to`
3. Build a notification promises array:

**Handoff detection:**
- If `oldStatusDef.owner_role !== newStatusDef.owner_role`, query `user_roles` table for all users with `role = newStatusDef.owner_role`
- For each matching user (excluding the current user who made the change), call `createNotification(userId, "Job Ready: [new status label]", "[job title] at [address] needs your attention", "handoff", "cm_job", jobId)`

**Creator/Assignee notifications (always):**
- If `job.created_by` exists and is not the current user (and wasn't already notified in handoff), notify them: `createNotification(createdBy, "Status Update: [title]", "Moved to [new status label]", "status_change", "cm_job", jobId)`
- If `job.assigned_to` exists and is not the current user (and wasn't already notified), notify them similarly

All notification calls are fire-and-forget via `Promise.all`, so they don't block the UI.

### Implementation detail
- The `user_roles` query: `supabase.from("user_roles").select("user_id").eq("role", newOwnerRole)` -- this table is readable by admins, but we need all authenticated users to query it for handoff detection
- Since `user_roles` RLS only allows admins and self-read, we need to add a SELECT policy: "Authenticated users can read user_roles" so the handoff query works for field_ops and engineers too

---

## 2. Database Migration: user_roles SELECT Policy

Add a new RLS policy on `user_roles` to allow any authenticated user to read all roles. This is needed so that when a field_ops user completes a status change, the client can query `user_roles` to find engineers for handoff notifications.

```sql
CREATE POLICY "Authenticated read user_roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);
```

This is safe because role information is not sensitive -- users already see each other's names and assignments.

---

## 3. "Your Turn" Visual Indicator on Job Cards

### Changes to `DraggableJobCard` component (lines 130-184)

Add two new props:
- `isYourTurn: boolean` -- whether the current user's role matches the column's `owner_role`

Visual treatment when `isYourTurn` is true:
- Add a left border accent: `border-l-2 border-l-primary`
- Show a small "Your Turn" badge at the top-right of the card: `<Badge variant="default" className="text-[9px] px-1 py-0">Your Turn</Badge>`

### Changes to `KanbanColumn` component (lines 186-220)

Add a new prop `userRole: string | null` and pass it through. Each card's `isYourTurn` is computed by comparing `userRole` to `statusDef.owner_role`.

### Changes to the board render (where KanbanColumn is used)

Pass `role` (from `useAuth`) to each `KanbanColumn`, which then computes `isYourTurn` per card based on `statusDef.owner_role === userRole`.

---

## Files

| File | Action |
|------|--------|
| Migration SQL | Add authenticated SELECT policy on `user_roles` |
| `src/components/ops/CMJobsBoard.tsx` | Enhance `changeJobStatus`, update `DraggableJobCard` and `KanbanColumn` props |

## Technical Details

| Item | Detail |
|------|--------|
| Handoff query | `supabase.from("user_roles").select("user_id").eq("role", ownerRole)` |
| Deduplication | Use a `Set` of already-notified user IDs to avoid duplicate notifications (e.g., if creator also has the handoff role) |
| Current user exclusion | Always exclude `user.id` from all notification recipients |
| Notification type | "handoff" for role changes, "status_change" for creator/assignee FYI |
| "Your Turn" styling | `border-l-2 border-l-primary` + small Badge -- subtle but visible |
| No drag logic changes | `changeJobStatus` is the single shared function for both drag and dropdown, so both paths get the new behavior automatically |

