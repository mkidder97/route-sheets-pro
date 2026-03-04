

# Move CM Project Wizard to Office Interface

## Summary
Move the project setup wizard from the field interface (`/field/cm/new` in FieldLayout) to the office interface (`/cm/new` in UnifiedLayout). Add "CM Projects" to the office nav. Remove the FAB from the field projects list.

## Changes

### 1. Move file
- `src/pages/field/cm/CMProjectNew.tsx` → `src/pages/cm/CMProjectNew.tsx`
- No internal logic changes except two `navigate()` calls

### 2. Update CMProjectNew.tsx (two lines only)
- Line 345: `navigate(\`/field/cm/${project!.id}\`)` → `navigate(\`/cm/${project!.id}\`)`
- Line 906: `navigate("/field/cm")` → `navigate("/cm")`

### 3. Update App.tsx
- Change lazy import path from `"./pages/field/cm/CMProjectNew"` to `"./pages/cm/CMProjectNew"`
- Remove `/field/cm/new` route from the FieldLayout group (line 115)
- Add two routes inside the UnifiedLayout group (after ops routes, before admin):
  - `/cm/new` → `CMProjectNew`
  - `/cm` → `CMProjectsList` (reuses the existing field list component for now)

### 4. Update CMProjectsList.tsx (field version)
- Remove the FAB block (lines 115-123) and the unused `Plus` import
- Remove the `canCreate` variable and the `useAuth` import (no longer needed)

### 5. Update UnifiedLayout.tsx nav
- Add "CM Projects" to the Operations section items: `{ label: "CM Projects", to: "/cm" }`
- Add `"/cm"` to the Operations prefix array so the section highlights correctly

## What does NOT change
- Wizard internal logic, steps, form state, submission code
- FieldLayout, FieldHome, or any other field routes
- CMProjectDetail or visit routes (remain under `/field/cm/:projectId`)

