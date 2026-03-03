

# CM Project Setup Wizard — `/field/cm/new`

## Overview
Create a 5-step stepper form for configuring new CM projects. All data is collected client-side and saved to the database only on final submission. No `contractors` table exists yet, so Step 3 will use a free-text contractor name field instead of a searchable select (the `cm_projects.contractor_id` column will remain null; we store the name in the contractor contacts JSONB).

## Routing
- Add lazy import for `CMProjectNew` in `App.tsx`
- Add route `/field/cm/new` above the `:projectId` route so it matches first

## New File: `src/pages/field/cm/CMProjectNew.tsx`

Single file containing the full wizard. Approximately 600-700 lines.

### State Management
- `step` state (1-5) controls which panel is visible
- All form data held in a single `formData` state object
- `submitting` boolean disables all inputs and shows loader on submit

### Step Indicator
- Horizontal row of 5 numbered circles with labels below, connected by lines
- Completed steps: blue fill. Current step: blue outline. Future steps: slate-700
- Labels: "Project Info", "Owner", "Contractor", "CC List", "Checklist"

### Step 1 — Project Info
- **Building**: searchable select using Popover + Command (cmdk) querying `buildings` table. Display `property_name` with `address, city, state` subtitle. Store `building_id`.
- **Project Name**: required text input
- **RI Number**: optional text input
- **Membrane Type**: text input
- **Contract Start / Completion Dates**: two date pickers (Popover + Calendar pattern from shadcn)
- **Total Contract Days**: number input, auto-calculated via `differenceInCalendarDays` when both dates set, but user can override
- **Status**: Select with Active / On Hold / Complete, default Active

### Step 2 — Owner Information
- Owner Company, Owner Address, Owner City/State/ZIP: text inputs
- Dynamic contacts list: each row has name_title, phone, email fields. Min 1 contact. "Add Contact" button appends a row. Trash icon removes (disabled if only 1).

### Step 3 — Contractor Information
- Contractor Name: text input (no table to query)
- Dynamic contacts list: same pattern as Step 2. Min 1 contact.

### Step 4 — CC Distribution List
- Instructional label at top
- Dynamic list: each entry has `names` (text) and `org` (text). Min 1 entry. "Add CC Group" / Trash pattern.

### Step 5 — Checklist Sections
- Instructional label
- Each section: title text input + numbered checklist items (text inputs). "Add Item" / Trash per item. Up/Down arrow buttons to reorder sections.
- "Add Section" button
- Min 1 section with min 1 item
- AI Parse button hidden (no edge function exists yet — will simply not render it)

### Navigation
- "Cancel" button (all steps) returns to `/field/cm`
- "Next" / "Back" buttons for step navigation
- Step 5 shows "Create Project" instead of "Next"

### Validation
- Step 1: building_id and project_name required
- Step 2: at least 1 owner contact with name_title filled
- Step 3: at least 1 contractor contact with name_title filled
- Step 4: at least 1 CC entry with names filled
- Step 5: at least 1 section with title and at least 1 item
- Validation runs on "Next" click; toast shown if invalid

### Submission Logic
1. Insert into `cm_projects`: project_name, ri_number, building_id, membrane_type, contract_start_date, contract_completion_date, total_contract_days, status, owner_company, owner_address, owner_city_state_zip, owner_contacts (JSONB), contractor_contacts (JSONB), cc_list (JSONB), created_by (auth.uid())
2. Insert into `cm_project_sections`: one row per section with section_title, checklist_items (JSONB string array), sort_order, cm_project_id
3. On success: navigate to `/field/cm/:newId`
4. On error: toast error, stay on step 5

### Styling
- Dark theme (`bg-slate-900` page, `bg-slate-800` cards, `border-slate-700/50`)
- Inputs: `bg-slate-900 border-slate-600 text-slate-100`
- All touch targets min 44px
- Responsive: works on iPad and mobile within FieldLayout

## Files Changed
- **New**: `src/pages/field/cm/CMProjectNew.tsx`
- **Modified**: `src/App.tsx` (add lazy import + route)

## No Database Changes Required
All target tables (`cm_projects`, `cm_project_sections`) already exist with the correct columns.

