

# Add Property Manager Info Everywhere

## Problem
The original Excel upload has PM columns ("Property Manager", "PM Phone #"), but the upload pipeline doesn't map them. So PM data never gets saved, and even though the Route Builder dropdown already has code to show PM info, it's always empty. The PDF and Excel generators also don't include PM fields, and the Buildings page expanded row doesn't show PM info.

## Changes

### 1. Upload Pipeline -- `src/lib/spreadsheet-parser.ts`

Add 3 new entries to `SYSTEM_FIELDS`:
- `property_manager_name` (label: "Property Manager Name")
- `property_manager_phone` (label: "PM Phone #")
- `property_manager_email` (label: "PM Email")

Add fuzzy matching keywords to `FUZZY_MAP`:
- `property_manager_name`: ["property manager", "pm name", "manager name", "pm", "manager"]
- `property_manager_phone`: ["pm phone", "phone", "manager phone", "pm #", "phone #", "pm phone #"]
- `property_manager_email`: ["pm email", "manager email", "email"]

Add the 3 fields to `ParsedBuilding` interface and extract them in `mapRowToBuilding`.

### 2. Upload Insert -- `src/pages/Upload.tsx`

Add the 3 PM fields to the building insert batch (around line 170-194):
- `property_manager_name: b.property_manager_name || null`
- `property_manager_phone: b.property_manager_phone || null`
- `property_manager_email: b.property_manager_email || null`

### 3. PDF Generator -- `src/lib/pdf-generator.ts`

Add PM fields to `BuildingData` interface:
- `property_manager_name: string | null`
- `property_manager_phone: string | null`
- `property_manager_email: string | null`

Add a "PM Contact" column to the daily route sheet table, showing name and phone on separate lines.

### 4. Excel Generator -- `src/lib/excel-generator.ts`

Add 3 new columns to the `buildingRow` function output:
- "PM Name"
- "PM Phone"
- "PM Email"

Add matching column widths to `detailColWidths`.

### 5. Schedules Data Fetch -- `src/pages/Schedules.tsx`

Update the building mapping (around line 228-247) to include the 3 PM fields when building the `BuildingData` objects from the database query.

### 6. Buildings Page Expanded Row -- `src/pages/Buildings.tsx`

Add PM contact section to the expanded detail view (around line 294-305), showing name, clickable phone link, and clickable email link -- same pattern as Route Builder.

## No Database Changes
The `property_manager_name`, `property_manager_phone`, and `property_manager_email` columns already exist on the `buildings` table.

## After This Change
Re-uploading the Excel will populate PM data. All views (Buildings page, Route Builder dropdown, PDF, Excel) will display it.

## Files

| File | Action |
|------|--------|
| `src/lib/spreadsheet-parser.ts` | Add PM fields to SYSTEM_FIELDS, FUZZY_MAP, ParsedBuilding, mapRowToBuilding |
| `src/pages/Upload.tsx` | Add PM fields to insert batch |
| `src/lib/pdf-generator.ts` | Add PM fields to BuildingData, add PM column to daily route table |
| `src/lib/excel-generator.ts` | Add PM columns to spreadsheet output |
| `src/pages/Schedules.tsx` | Include PM fields in building data mapping |
| `src/pages/Buildings.tsx` | Show PM info in expanded row |

