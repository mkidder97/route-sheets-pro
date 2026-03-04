

## Generate CM Report — Edge Function + UI Wiring

### Overview

Three deliverables: (A) edge function `generate-cm-report` that builds a multi-page PDF, uploads to storage, optionally emails CC list; (B) wire the existing Generate PDF / Download PDF buttons in `CMProjectDetail.tsx`; (C) prompt for RESEND_API_KEY secret.

---

### Part A: Edge Function `supabase/functions/generate-cm-report/index.ts`

**Library**: Use `npm:pdf-lib` (server-safe, no DOM dependencies). Do NOT use jsPDF — it depends on browser globals (canvas, Blob, window) that don't exist in Deno edge runtime. Draw all text, lines, and table rows manually with pdf-lib's `drawText()`, `drawLine()`, `drawRectangle()`.

**Config**: Add `[functions.generate-cm-report]` with `verify_jwt = false` to `supabase/config.toml`. Validate JWT in code.

**Request**: `POST { visitId: string }`, requires Authorization header.

**Data fetch** (service role client):
- `cm_visits` by visitId
- `cm_projects` joined with `buildings` — `contractor_name` (TEXT), `contractor_contacts` (JSONB), `owner_contacts`, `cc_list`
- `user_profiles` for `src_associate_id` → full_name
- `cm_visit_sections` ordered by `sort_order`
- `cm_photos` ordered by `sort_order`

**PDF structure** (matching Go Canvas layout):

1. **Page 1 — Cover**: Header with "FIELD OBSERVATION REPORT: #N" and date. "SRC" text top-right in dark green. Two-column layout: LEFT = Project/Owner/Roof Consultant blocks; RIGHT = Roofing Contractor block. Contractor data from `cm_projects.contractor_name` + `contractor_contacts` JSONB. SRC info hardcoded (875 Pasadena Ave, John Biggers, etc.).

2. **Pages 2+ — Content**: Repeating header (project name left, SRC right, rule). Weather line (rain/wind/temp with values). Overview narrative. Each `cm_visit_section`: title ALL CAPS bold, numbered checklist items, notes paragraph.

3. **Final Summary Page**: Completion percentages (TPO, membrane, flashing, sheet metal). Schedule stats (contract completion date, days used, weather days, remaining). Unit price quantities. General notes. SRC Associate line. CC list.

4. **Photo Pages**: 2 photos per page in a table with sage green (#A8C5A0) header row. Columns: Photo # | Description | Photo. Fetch each `public_url`, convert to `Uint8Array`, embed via `embedJpg()`/`embedPng()`. Scale to ~280×210px.

5. **Footer** (every page): "powered by RoofMind" left, first 8 chars of visitId right.

**Post-generation**:
1. Upload PDF bytes to `cm-reports/reports/{visitId}/report.pdf`
2. Get public URL
3. `UPDATE cm_visits SET pdf_path = publicUrl, pdf_generated_at = now()`
4. Return `{ success: true, pdfUrl }`

### Part B: Email Distribution

After PDF generation, check `Deno.env.get("RESEND_API_KEY")`.
- **If set**: Send via Resend API to all emails from `cc_list` + `owner_contacts` JSONB. Subject exactly: `[building_name] — Field Observation Report #[N] — [MM/DD/YYYY]`. Attach PDF as base64.
- **If not set**: `console.log("Email not configured — skipping")`. No error.

### Part C: UI Changes — `CMProjectDetail.tsx`

Swap the existing placeholder buttons (lines 340-362):

- Add `generatingPdfId` state to track which visit is generating
- **No pdf_path**: "Generate PDF" button calls `supabase.functions.invoke("generate-cm-report", { body: { visitId: visit.id } })`. Shows Loader2 spinner. On success: invalidate visits query, success toast. On error: error toast.
- **Has pdf_path**: "Download PDF" link + small "Regenerate" icon button that calls the same function.
- All guarded by existing `isOffice && visit.status === "submitted"` check and `e.stopPropagation()` wrapper.

### Part D: Secret

Prompt user to add `RESEND_API_KEY` for email delivery. Function works without it (PDF-only mode).

### Files Changed

- **New**: `supabase/functions/generate-cm-report/index.ts`
- **Modified**: `supabase/config.toml` (add function entry)
- **Modified**: `src/pages/cm/CMProjectDetail.tsx` (wire Generate/Download/Regenerate buttons)

### No Migration Required

