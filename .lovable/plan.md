

## Visit Card Button Cleanup — CMProjectDetail.tsx

### Changes (UI/labels only, no logic changes)

**1. Replace icon-only RefreshCw button with labeled "Send to OneDrive" button** (lines 410-422)
- Change from `variant="ghost" size="icon"` to `variant="ghost" size="sm"` with text "Send to OneDrive"
- Add `title="Regenerate PDF and send to OneDrive"`
- Keep existing `disabled={generatingPdfId === visit.id}` and Loader2 spinner logic

**2. Rename "Revert" to "Revert to Draft"** (line 446)

**3. Remove the draft+existing-pdf block** (lines 451-482)
- Delete the entire `{isOffice && visit.status === "draft" && visit.pdf_path && (...)}` block

### File Modified
- `src/pages/cm/CMProjectDetail.tsx` — 3 edits, labels and removal only

