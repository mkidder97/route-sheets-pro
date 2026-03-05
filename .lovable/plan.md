
# Construction Management Module -- Database Migration and Storage

## Summary
Execute the user-provided SQL migration to create 5 new tables for the Construction Management module, plus create a "cm-reports" storage bucket with public read access. No UI changes.

## Tables to Create
1. **cm_projects** -- Core project record linked to buildings/contractors, with RLS, updated_at trigger
2. **cm_project_sections** -- Checklist template sections per project, with RLS, updated_at trigger
3. **cm_visits** -- Individual site visit records with weather/completion/schedule tracking, with RLS, updated_at trigger, and auto-increment visit_number trigger
4. **cm_visit_sections** -- Per-visit snapshot of checklist sections, with RLS, updated_at trigger
5. **cm_photos** -- Visit photos with numbering, with RLS

## Additional Objects
- **Function**: `set_cm_visit_number()` -- auto-sets visit_number on insert
- **Trigger**: `auto_set_cm_visit_number` on cm_visits

## Storage
- Create **cm-reports** bucket with public read access (for generated PDF reports)

## RLS Approach
All 5 tables use a simple authenticated-all policy (`USING (true) WITH CHECK (true)`), matching the user's exact SQL.

## Execution
Single migration containing all 5 tables, triggers, and function. Storage bucket created separately via Supabase tooling. No UI files created or modified.
