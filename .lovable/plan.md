

## Update Make Webhook Payload — generate-cm-report Edge Function

### What Changes
In `supabase/functions/generate-cm-report/index.ts`, add three fields to the existing Make webhook `POST` body (around line 350):

- `clientName`: `project.owner_company ?? ""`
- `buildingId`: `project.building_id`
- `suggestedFileName`: constructed from building name, visit number, and formatted date

### Exact Edit
The current webhook body (lines ~347-353):

```typescript
body: JSON.stringify({
  pdfUrl: publicUrl,
  buildingName,
  projectName: project.project_name,
  visitNumber: visit.visit_number,
  visitDate: formatDate(visit.visit_date),
}),
```

Becomes:

```typescript
body: JSON.stringify({
  pdfUrl: publicUrl,
  buildingName,
  projectName: project.project_name,
  visitNumber: visit.visit_number,
  visitDate: formatDate(visit.visit_date),
  clientName: project.owner_company ?? "",
  buildingId: project.building_id,
  suggestedFileName: `FOR_${buildingName.replace(/\s+/g, '_')}_Visit${visit.visit_number}_${formatDate(visit.visit_date).replace(/\//g, '')}.pdf`,
}),
```

### Files Modified
- `supabase/functions/generate-cm-report/index.ts` — 3 lines added to webhook payload

No other changes.

