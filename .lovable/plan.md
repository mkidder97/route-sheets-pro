

## Replace FieldInspections.tsx

### Single file change: `src/pages/field/FieldInspections.tsx`

Replace the placeholder with a component that:
- Imports `useAuth`, `FieldTodayView`, and `ClipboardCheck`
- If `profile.inspector_id` exists → renders `<FieldTodayView inspectorId={profile.inspector_id} />`
- Otherwise → centered fallback with icon + two lines of text

No other files touched.

