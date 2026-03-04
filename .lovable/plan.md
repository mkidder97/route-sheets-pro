

# CM Visit Form Stepper

## Overview
Create `src/pages/field/cm/CMVisitForm.tsx` — a full-screen step-through visit form rendered inside FieldLayout at `/field/cm/:projectId/visits/:visitId`. Replace the current route that points to `CMProjectDetail`.

## New File: `src/pages/field/cm/CMVisitForm.tsx`

### Data Loading
- Fetch `cm_visits` row by visitId (includes visit_number, visit_date, status, src_associate_id, etc.)
- Fetch `cm_projects` with `buildings(property_name, address, city, state, zip_code)` by projectId
- Fetch `cm_visit_sections` WHERE cm_visit_id = visitId, ordered by sort_order

### Section Initialization (runs once on mount)
```
if cm_visit_sections count === 0:
  fetch cm_project_sections WHERE cm_project_id = projectId
  INSERT into cm_visit_sections: { cm_visit_id, cm_project_section_id, section_title, checklist_items, sort_order }
  refetch cm_visit_sections
```
Use a `useEffect` with a ref flag to prevent double-execution in StrictMode.

### Auto-Save
- `useRef` for debounce timers (1500ms)
- State: `saveStatus: 'idle' | 'saving' | 'saved'`
- Helper function `debouncedSave(table, id, payload)` that sets status to saving, calls supabase update, sets status to saved
- Used for: `cm_visits.src_associate_id` (step 3) and `cm_visit_sections.notes` (steps 6-N)

### Stepper State
- `currentStep` (0-indexed), computed `totalSteps` from 4 static + sections.length + 3 placeholders
- Step definitions array built dynamically:
  1. PROJECT
  2. OWNER
  3. ROOF CONSULTANT
  4. ROOFING CONTRACTOR
  5. WEATHER & OVERVIEW (placeholder)
  6..N. One per cm_visit_section (dynamic)
  N+1. COMPLETION & SCHEDULE (placeholder)
  N+2. PHOTO GRID (placeholder)

### Shell UI
- Full screen within FieldLayout's `<Outlet />` — uses `absolute inset-0` or negative margins to fill the content area
- **Top bar**: Step title (ALL CAPS, bold, centered). Right side: save status indicator. Left side: hamburger (Menu icon) → opens TOC drawer
- **TOC Drawer**: Sheet from left listing all step names. Current step has a green dot (bg-emerald-500). Tap any step to jump + close drawer
- **Bottom**: Fixed progress bar (teal `#0F766E`, height 3px). Below it: Back/Next buttons row, min-h-[44px]
  - Back disabled on step 0
  - Last step shows "Submit Visit" (disabled placeholder)
- **Submitted banner**: If `cm_visits.status === 'submitted'`, render amber banner across all steps: "This visit was submitted on [date]. Contact the office to make changes." All fields become read-only.

### Step 1 — PROJECT (read-only)
- "FIELD OBSERVATION REPORT: #[visit_number]" | "DATE: [visit_date MM/DD/YYYY]"
- Project name bold, building address, city/state/zip

### Step 2 — OWNER (read-only)
- owner_company, owner_address, owner_city_state_zip
- Each entry in owner_contacts JSONB: name/title, phone, email

### Step 3 — ROOF CONSULTANT (read-only + one editable field)
- Static SRC block (hardcoded company info per prompt)
- If src_associate_id is null AND not submitted: show select dropdown from user_profiles (two-step query via user_roles, same pattern as CMProjectDetail inspector dropdown)
- On select: auto-save to `cm_visits.src_associate_id` with 1500ms debounce
- If src_associate_id is set: show full_name, phone, email read-only (fetch from user_profiles)

### Step 4 — ROOFING CONTRACTOR (read-only)
- contractor_name from cm_projects
- Each entry in contractor_contacts JSONB: name/title, phone, email

### Step 5 — WEATHER & OVERVIEW (placeholder)
- Centered text: "Coming in next prompt"

### Steps 6-N — CHECKLIST SECTIONS
- Title = section_title (ALL CAPS)
- Numbered read-only list of checklist_items
- Below: "Notes:" label + auto-expanding textarea (min 4 rows)
- Value = cm_visit_sections.notes, auto-saves with 1500ms debounce
- If submitted: textarea is read-only

### Step N+1 — COMPLETION & SCHEDULE (placeholder)
- Centered text: "Coming in next prompt"

### Step N+2 — PHOTO GRID (placeholder)
- Centered text: "Coming in next prompt"

## Routing: `App.tsx`
- Add lazy import: `const CMVisitForm = lazy(() => import("./pages/field/cm/CMVisitForm"))`
- Change line 122 (`/field/cm/:projectId/visits/:visitId` → `CMVisitForm` instead of `CMProjectDetail`)

## Files
1. **Created**: `src/pages/field/cm/CMVisitForm.tsx`
2. **Modified**: `src/App.tsx` (add import, update one route)

## Not Changed
- FieldLayout, CMProjectDetail, CMJobsBoard, any other file
- No database migrations needed

