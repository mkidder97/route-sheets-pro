

# CM Project Wizard — Three Fixes

## 1. Migration: Add `contractor_name` column to `cm_projects`
Add `contractor_name TEXT` column (nullable) to `cm_projects`. Then update the insert in `CMProjectNew.tsx` (line ~300) to include `contractor_name: form.contractor_name.trim() || null`.

## 2. Add placeholders to Owner Company and Owner Address inputs
In `renderStep2()` (~lines 676-691):
- Owner Company input: add `placeholder="e.g. Realty Associates"`
- Owner Address input: add `placeholder="e.g. 123 Main Street"`

## 3. Hide reorder arrows when only one section
Wrap the up/down arrow `<div>` (lines 805-822) in a conditional: only render when `form.sections.length > 1`.

## Files Changed
- **Migration**: `ALTER TABLE cm_projects ADD COLUMN contractor_name TEXT;`
- **Modified**: `src/pages/field/cm/CMProjectNew.tsx` (3 edits: submission insert, placeholders, conditional arrows)

