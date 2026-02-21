

# CM Jobs: Board / List View Toggle

## Overview

Add a "Board" / "List" toggle to the CM Jobs section header. The List view provides a sortable, paginated data table as an alternative to the Kanban board, ideal for 30-75+ active jobs. Both views share the same filters, detail panel (Sheet), and data.

---

## Changes (single file)

**File:** `src/components/ops/CMJobsBoard.tsx`

---

## 1. View Toggle State with localStorage Persistence

Add a new state variable `viewMode` initialized from `localStorage.getItem("roofroute_cm_view")` or defaulting to `"board"`. On toggle, save to localStorage with the same key (matches the existing `roofroute_` prefix convention).

Add a toggle control in the header bar (after the priority filter, before the "New Job" button) using two small buttons or a segmented control styled with the existing `Button` component:
- "Board" (grid icon from lucide: `LayoutGrid`)  
- "List" (list icon from lucide: `List`)

---

## 2. Search Bar (List view only)

Add a search `Input` that appears when `viewMode === "list"`, positioned in the filter bar. The search filters `filteredJobs` further by matching `title` or `address` (case-insensitive substring match) client-side via `useMemo`.

---

## 3. List View Table

When `viewMode === "list"`, render a data table instead of the Kanban board (the DndContext block). Use the existing shadcn `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableCell`, `TableBody` components already in the project.

### Columns

| Column | Data | Rendering |
|--------|------|-----------|
| Title | `job.title` | Plain text, bold |
| Client | `job.clients?.name` | Plain text |
| Status | `job.status` | `Badge` with `backgroundColor` from `getStatusColor(status)` and white text, label from `getStatusLabel(status)` |
| Assigned To | `job.assigned_user?.full_name` | Plain text or "—" |
| Priority | `job.priority` | `Badge` with existing `PRIORITY_COLORS` mapping |
| Scheduled | `job.scheduled_date` | Formatted date or "—" |
| Due Date | `job.due_date` | Formatted date or "—" |
| Last Updated | `job.updated_at` | Relative time via `formatDistanceToNow` (requires adding `updated_at` to the CMJob type and fetch query) |

### Sorting

Add state: `sortColumn` (string, default "title") and `sortDir` ("asc" | "desc", default "asc"). Clicking a column header toggles sort direction if same column, or sets new column ascending. Apply sorting in a `useMemo` over the filtered+searched jobs.

Column headers render with a click handler and a small arrow indicator (ChevronUp/ChevronDown from lucide) for the active sort column.

### Pagination

Add state: `page` (number, default 0). Display 20 rows per page. Slice the sorted array by `page * 20` to `(page + 1) * 20`. Show simple "Previous / Page X of Y / Next" controls below the table using `Button` components. Reset `page` to 0 when filters, search, or sort change.

### Row Click

Each `TableRow` has `onClick={() => setDetailJobId(job.id)}` with `cursor-pointer` class, opening the same Sheet detail panel used by the Kanban cards.

---

## 4. CMJob Type and Fetch Update

Add `updated_at: string` to the `CMJob` type (line ~67). The `fetchJobs` query already does `select("*", ...)` so `updated_at` is already returned -- we just need the type definition to use it.

---

## 5. Imports

Add to the existing lucide import line: `LayoutGrid`, `List`, `ChevronUp`, `ChevronDown`.

Import `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` from `@/components/ui/table`.

---

## Technical Details

| Item | Detail |
|------|--------|
| localStorage key | `roofroute_cm_view` (matches existing prefix convention) |
| Default view | `"board"` |
| Search scope | Client-side filter on `title` and `address` fields |
| Pagination size | 20 rows per page |
| Sort implementation | `useMemo` with `Array.sort` comparator based on `sortColumn` and `sortDir` |
| No new dependencies | Uses existing shadcn Table, lucide icons, date-fns |
| No new files | Everything stays in CMJobsBoard.tsx |
| DndContext | Only rendered when `viewMode === "board"` -- no performance cost in list mode |

