

# Replace Warranties Tab with Roof Specs

## Summary
Replace the "Warranties" stub (lines 515-522) in `BuildingDetail.tsx` with a full Roof Specs tab backed by the existing `roof_sections` and `roof_assembly_layers` tables. No database changes needed -- tables and types already exist.

## RLS Note
The existing RLS policies on `roof_sections` and `roof_assembly_layers` use `auth.jwt() ->> 'role'` which won't match the app's custom role system (roles are in `user_roles` table, not JWT claims). This will cause write operations to fail silently. A migration will fix the write policies to use `has_ops_role()` instead, matching the pattern used by all other tables.

## Changes

### 1. Fix RLS policies (migration)
Update the write policies on both tables to use `has_ops_role()` instead of JWT claims:
- `roof_sections`: DROP the `admin write roof_sections` ALL policy, replace with separate INSERT/UPDATE (admin + office_manager) and DELETE (admin only) policies using `has_ops_role()`.
- `roof_assembly_layers`: Same pattern -- replace the ALL policy with INSERT/UPDATE/DELETE using `has_ops_role()`.

### 2. BuildingDetail.tsx modifications (single file)

**New imports**: `Plus`, `Trash2`, `Layers`, `Sun`, `DollarSign`, `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, `ChevronDown`.

**New state variables**:
- `roofSections` -- array of roof section rows
- `selectedSectionId` -- currently selected section UUID
- `assemblyLayers` -- array of layer rows for the selected section
- Dialog open states for: add section, edit summary, edit details, edit assembly recover fields, edit capital, add layer, edit layer
- Form data objects for each dialog

**New fetch functions** (called alongside existing loads):
- `loadRoofSections()` -- fetches `roof_sections` filtered by `building_id`, ordered by `section_name`. Auto-selects first section.
- `loadAssemblyLayers(sectionId)` -- fetches `roof_assembly_layers` filtered by `roof_section_id`, ordered by `sort_order`. Called when `selectedSectionId` changes.

**Tab rename**: `warranties` trigger/content becomes `roofspecs` with label "Roof Specs".

**Tab content structure**:

```text
+--------------------------------------------------+
| [Roof A] [Roof B] [Roof C]  [+ Add Section]     |
+--------------------------------------------------+
| > Roof Summary & Warranty  (collapsible, open)   |
|   Two-column layout: left=specs, right=warranty  |
|                                        [pencil]  |
+--------------------------------------------------+
| > Roof Details             (collapsible, open)   |
|   2-col grid of system fields                    |
|                                        [pencil]  |
+--------------------------------------------------+
| > Roof Assembly            (collapsible, open)   |
|   Layer table + add button                       |
|   Recover fields below table           [pencil]  |
+--------------------------------------------------+
| > Capital & Sustainability (collapsible, open)   |
|   2-col: expenses left, toggles right            |
|                                        [pencil]  |
+--------------------------------------------------+
```

**Empty state** (no sections): Layers icon (w-12 opacity-20), "No roof sections yet" text, "Add Section" button (canWrite only).

**Card details**:

- Card 1 -- Roof Summary and Warranty: section_name, roof_area_sqft (formatted), year_installed, replacement_year, remaining life = replacement_year - 2026 (red "Expired" if <= 0), rating as "X / 10", manufacturer, installing_contractor, repairing_contractor, is_live Switch (admin only, immediate update). Right side: has_manufacturer_warranty badge, warranty_issued_by, warranty_guarantee_number, warranty_expiration_date (red "Expired" if past), has_contractor_warranty badge, contractor_warranty_expiration.

- Card 2 -- Roof Details: roof_system, system_description (full width), lttr_value, perimeter_detail, flashing_detail, drainage_system in 2-column grid.

- Card 3 -- Roof Assembly: Table (Layer Type | Description | Attachment | Thickness | Actions). Layer type Select: Membrane, Insulation, Deck, Vapor Barrier. Add/edit/delete rows (canWrite). Below table: has_recover Switch, recover_type, year_originally_installed.

- Card 4 -- Capital and Sustainability: capital_expense_amount ($), capital_expense_per_sqft ($), capital_expense_type, capital_expense_year, maintenance_budget_amount ($), maintenance_budget_source_date. has_solar Switch, has_daylighting Switch.

Each card has a pencil edit button (canWrite only) opening a Dialog pre-populated with that card's fields. On save: UPDATE the `roof_sections` row (or INSERT/UPDATE/DELETE `roof_assembly_layers` for Card 3), re-fetch.

**Styling**: All cards use `bg-slate-800 border-slate-700/50`. Labels: `text-slate-400 text-xs`. Values: `text-white`. Muted: `text-slate-500`. Pills: active `bg-primary text-white rounded-full px-4 py-1.5`, inactive `bg-slate-700 text-slate-300 rounded-full px-4 py-1.5`. No emojis. Lucide icons only.

### What is NOT changed
- No other tabs (Overview, Contacts, History, Notes, Documents)
- No routing changes
- No changes to existing data fetching (loadBuilding, loadHistory)
- No changes to any other files (types.ts is auto-generated, not touched)
