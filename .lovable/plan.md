
# Delete FieldView and Schedules Pages

## 1. Delete files
- Delete `src/pages/FieldView.tsx`
- Delete `src/pages/Schedules.tsx`

## 2. Update `src/App.tsx`
- Remove imports for `Schedules` (line 9) and `FieldView` (line 14)
- Remove route `/schedules` (line 29) and `/field` (line 34)

## 3. Update `src/components/AppSidebar.tsx`
- Remove `Calendar` from the lucide-react import (line 1)
- Remove the Schedules entry from `mainNav` array (line 19), leaving Dashboard, Upload, and Route Builder

## What stays untouched
- All other pages, components, and database tables (including `generated_documents`)
- `ChevronLeft` stays in the import even though unused -- not in scope for this change
