

# Job Types Management Tab in OpsSettings

## Overview

Add a "Job Types" tab to the Settings page, visible only to admins. It lists all `cm_job_types` with inline `is_active` toggle, and opens an edit dialog with drag-and-drop status reordering, color editing, owner_role assignment, and the ability to add/remove statuses.

---

## Changes

**File:** `src/pages/ops/OpsSettings.tsx` (all changes in this single file)

---

## 1. New Tab in OpsSettings Component

Add a "Job Types" tab trigger and content, visible only when `role === "admin"`:

```
{role === "admin" && <TabsTrigger value="jobtypes">Job Types</TabsTrigger>}
```

Default tab logic: if admin, default to `"users"`; the new tab is just an additional option.

---

## 2. JobTypeManagement Component

A new function component rendered inside the "jobtypes" `TabsContent`.

**State:**
- `jobTypes: JobType[]` -- fetched from `cm_job_types` ordered by `name`
- `loading: boolean`
- `editType: JobType | null` -- opens the edit dialog
- `addOpen: boolean` -- opens the add dialog

**List rendering (Table):**

| Column | Content |
|--------|---------|
| Name | `jobType.name` (bold) |
| Description | truncated to ~60 chars |
| Statuses | count badge, e.g. "11 stages" |
| Active | `Switch` toggle -- on change, update `cm_job_types.is_active` directly |

Click a row to open the edit dialog (`setEditType(jobType)`).

"Add Job Type" button at top-right.

---

## 3. Add Job Type Dialog

Simple dialog with:
- Name (required)
- Description (optional textarea)

On submit: insert into `cm_job_types` with `statuses: '[]'::jsonb`, `is_active: true`. Refresh list, close dialog.

---

## 4. Edit Job Type Dialog (the main feature)

A larger dialog (`DialogContent className="max-w-2xl"`) with:

### Top section
- Name input
- Description textarea
- is_active switch

### Statuses section -- drag-and-drop reorderable list

Uses `@dnd-kit/core` and `@dnd-kit/sortable` (already installed) to allow reordering statuses.

Each status row shows:
- Drag handle (GripVertical icon)
- **Label** (text input)
- **Key** (read-only, auto-generated from label on creation using `label.toLowerCase().replace(/\s+/g, "_")`)
- **Color** -- a small color swatch button that opens a preset color picker (a popover with ~12 preset colors like the ones used in the board: `#3498DB`, `#E67E22`, `#27AE60`, `#E74C3C`, `#9B59B6`, `#1ABC9C`, `#F1C40F`, `#34495E`, `#95A5A6`, `#2ECC71`, `#E84393`, `#0984E3`)
- **Owner Role** -- Select dropdown with the 4 ROLE_OPTIONS
- **Delete button** (Trash icon) -- on click, check if any `cm_jobs` have `status = this.key AND job_type_id = this.id`. If yes, show toast error "Cannot remove: X jobs use this status". If no, remove from the local array.

"Add Status" button at bottom of the list -- appends a new entry with default values `{ key: "new_status", label: "New Status", color: "#95A5A6", owner_role: "office_manager", order: nextOrder }`.

### Save button
On save:
1. Recalculate `order` fields (0, 1, 2...) based on current array position
2. Update `cm_job_types` row: `name`, `description`, `is_active`, `statuses` (the full JSONB array)
3. Toast success, close dialog, refresh list

---

## 5. Imports to Add

- `@dnd-kit/core`: `DndContext`, `closestCenter`, `PointerSensor`, `useSensor`, `useSensors`
- `@dnd-kit/sortable`: `SortableContext`, `useSortable`, `verticalListSortingStrategy`, `arrayMove`
- `lucide-react`: `GripVertical`, `Trash2` (add to existing import)
- `Textarea` from `@/components/ui/textarea`
- `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover`

---

## 6. Types

Reuse the same `StatusDef` shape from CMJobsBoard (defined locally since it's a different file):
```ts
interface StatusDef {
  key: string;
  label: string;
  color: string;
  owner_role: string;
  order: number;
}

interface JobType {
  id: string;
  name: string;
  description: string | null;
  statuses: StatusDef[];
  is_active: boolean;
}
```

---

## 7. Delete Status Safety Check

Before removing a status from the local array, run:
```ts
const { count } = await supabase
  .from("cm_jobs")
  .select("id", { count: "exact", head: true })
  .eq("job_type_id", jobType.id)
  .eq("status", statusKey);
```
If `count > 0`, block removal with a toast error.

---

## Technical Details

| Item | Detail |
|------|--------|
| RLS | `cm_job_types` already has admin/office_manager ALL policy -- no migration needed |
| DnD | `@dnd-kit/sortable` with `verticalListSortingStrategy`, same packages already in project |
| Color picker | Popover with preset swatches grid (no native color input -- keeps it consistent) |
| Key generation | For new statuses only; existing keys are immutable to avoid breaking `cm_jobs.status` references |
| No new files | Everything in OpsSettings.tsx following the existing pattern of function components in one file |

