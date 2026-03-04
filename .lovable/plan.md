

# Weather & Overview + Completion & Schedule Steps — Implementation

## Summary
Replace placeholder steps 5 and N+1 in `CMVisitForm.tsx` with full editable content. Filter "GROUND" section out of dynamic steps loop. Single file change.

## Changes — `src/pages/field/cm/CMVisitForm.tsx`

### Data model updates
- Expand `VisitData` interface with all weather/completion/schedule/notes fields
- Expand `ProjectData` interface with `contract_completion_date`, `total_contract_days`, `cc_list`, and `buildings.square_footage`
- Update project query select string accordingly

### Ground section filtering
- Derive `groundSection` (first section matching "ground" case-insensitive) and `displaySections` (everything else)
- Use `displaySections` for dynamic step names and step rendering loop

### Generic visit field handler
- `handleVisitFieldChange(field, value)` updates local visit state and calls `debouncedSave`
- Special case for schedule fields: recalculates `schedule_days_remaining` and saves it too

### Step 5 — WEATHER & OVERVIEW
- Weather Conditions: 3 stacked `<Input>` fields (rain, wind, temp)
- Overview: textarea for `overview_narrative`
- Ground Conditions: if ground section found, show checklist + notes textarea; otherwise plain textarea

### Completion step
- Observation: 4 number inputs (0-100) for TPO/membrane/flashing/sheet metal percentages
- Schedule: read-only contract line, 2 editable inputs, auto-calculated remaining days
- Unit Quantities: 3 number inputs
- General Notes: large textarea
- SRC Associate: read-only from existing state
- CC List: read-only from project JSONB
- Internal Notes: separator + muted label + textarea

### Imports
Add `Input` and `Separator`

## Files
1. **Modified**: `src/pages/field/cm/CMVisitForm.tsx`

No database migrations — columns exist. If saves fail due to missing columns, user will provide follow-up SQL.

