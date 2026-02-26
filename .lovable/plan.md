
# OpsCampaignDetail Full Refactor (Final)

Refactor the existing 938-line file into a tabbed campaign detail page with KPI cards, click-to-cycle status badges, an edit campaign dialog, and a status-note confirmation dialog. Single file change only.

## Architectural Requirements (locked)

1. **`canEdit`** used throughout (already defined on line 154)
2. **Single Dialog for status note** at component level with `pendingStatusRow` and `pendingNote` useState values -- rendered once outside the table
3. **No Popover** -- uses Dialog for skipped/needs_revisit confirmation

## Notes State Synchronization (3 sync points)

1. **On fetch**: after `setCampaign(data)`, call `setNotesText(data.notes ?? "")` to seed the Notes tab
2. **On Edit Dialog save**: after updating campaign local state, call `setNotesText(editForm.notes ?? "")` so the Notes tab reflects changes
3. **On Notes tab save**: after updating Supabase, call `setCampaign(prev => prev ? { ...prev, notes: notesText } : prev)` and `setEditForm(prev => ({ ...prev, notes: notesText }))` so the Edit Dialog stays in sync

## Changes to `src/pages/ops/OpsCampaignDetail.tsx`

### 1. New Imports
Add: `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`, `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` from `@/components/ui/dialog`, `Pencil, Building2, CheckCircle, Clock, AlertCircle, Loader2` from lucide-react.

### 2. Dark-Friendly Status Colors
Replace `BUILDING_STATUS_COLORS` (lines 110-116):
- `pending`: `bg-slate-500/15 text-slate-400`
- `in_progress`: `bg-blue-500/15 text-blue-400`
- `complete`: `bg-emerald-500/15 text-emerald-400`
- `skipped`: `bg-red-500/15 text-red-400`
- `needs_revisit`: `bg-amber-500/15 text-amber-400`

Replace `CAMPAIGN_STATUS_COLORS` (lines 125-130):
- `planning`: `bg-slate-500/15 text-slate-400`
- `active`: `bg-blue-500/15 text-blue-400`
- `complete`: `bg-emerald-500/15 text-emerald-400`
- `on_hold`: `bg-amber-500/15 text-amber-400`

### 3. Status Cycle Constant and Handler
Add constant:
```text
STATUS_CYCLE: pending -> in_progress -> complete -> skipped -> needs_revisit -> pending
```
Handler `handleStatusBadgeClick(cb)`: if next status is `skipped` or `needs_revisit`, set `pendingStatusRow` to open the Dialog. Otherwise call `updateBuildingStatus` directly.

### 4. New Component-Level State
```ts
const [pendingStatusRow, setPendingStatusRow] = useState<{
  cbId: string; buildingId: string; oldStatus: string; newStatus: string;
} | null>(null);
const [pendingNote, setPendingNote] = useState("");
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [editForm, setEditForm] = useState({ name: "", status: "", end_date: "", notes: "" });
const [editSaving, setEditSaving] = useState(false);
const [notesEdit, setNotesEdit] = useState(false);
const [notesText, setNotesText] = useState("");
const [notesSaving, setNotesSaving] = useState(false);
```

### 5. Status Note Confirmation Dialog
Rendered once at component level, outside the table. Uses Dialog (not Popover):
```tsx
<Dialog open={!!pendingStatusRow} onOpenChange={(open) => {
  if (!open) { setPendingStatusRow(null); setPendingNote(""); }
}}>
  <DialogContent className="max-w-sm bg-slate-800 border-slate-700">
    <DialogHeader>
      <DialogTitle className="text-slate-100">
        Add note for "{pendingStatusRow?.newStatus}" status
      </DialogTitle>
    </DialogHeader>
    <Textarea value={pendingNote} onChange={(e) => setPendingNote(e.target.value)}
      placeholder="Required note..." className="bg-slate-900 border-slate-600 min-h-[80px]" />
    <DialogFooter>
      <Button variant="ghost" size="sm" onClick={() => {
        setPendingStatusRow(null); setPendingNote("");
      }}>Cancel</Button>
      <Button size="sm" disabled={!pendingNote.trim()} onClick={async () => {
        if (!pendingStatusRow) return;
        await updateBuildingStatus(pendingStatusRow.cbId, pendingStatusRow.buildingId,
          pendingStatusRow.oldStatus, pendingStatusRow.newStatus);
        await supabase.from('campaign_buildings')
          .update({ inspector_notes: pendingNote.trim() })
          .eq('id', pendingStatusRow.cbId);
        setPendingStatusRow(null);
        setPendingNote("");
      }}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 6. Edit Campaign Dialog
- "Edit" button (Pencil icon) in header, visible when `canEdit`
- Fields: name (Input), status (Select), end_date (date Input), notes (Textarea)
- Pre-populates from `campaign` when opened
- On save: update `inspection_campaigns`, refresh campaign local state, **call `setNotesText(editForm.notes ?? "")`** (sync point 2)
- Styled: `bg-slate-800 border-slate-700`, inputs `bg-slate-900 border-slate-600`

### 7. Header Refinements
- Keep back button, h1 `text-2xl font-bold`
- Badge row: status (colored), client name, campaign type
- Progress bar: `h-1.5` (slimmer)
- Date range formatted
- Add Edit button next to Export (canEdit only)

### 8. Four KPI Stat Cards (below header, above tabs)
Computed from `buildings` array:
- **Total** -- Building2 icon in `bg-slate-500/15`
- **Complete** -- CheckCircle icon in `bg-emerald-500/15`
- **In Progress** -- Clock icon in `bg-blue-500/15`
- **Pending** -- AlertCircle icon in `bg-slate-400/15`

Each card: `rounded-xl bg-slate-800 border border-slate-700/50 p-5`, icon `w-9 h-9 rounded-lg`, label `text-[10px] uppercase tracking-widest text-slate-400`, number `text-4xl font-bold text-white leading-none`.

### 9. Tabs: "Buildings" | "Notes"
Wrap filters + table + bulk bar + comments inside `TabsContent value="buildings"`.

New `TabsContent value="notes"`:
- View mode: `text-sm text-slate-300 whitespace-pre-wrap`, shows `notesText`
- Edit mode (canEdit): Textarea `min-h-[200px] bg-slate-900 border-slate-600`, Save/Cancel
- On save: update `inspection_campaigns.notes`, **call `setCampaign(prev => prev ? { ...prev, notes: notesText } : prev)` and `setEditForm(prev => ({ ...prev, notes: notesText }))`** (sync point 3)
- Empty state: "No notes yet"

### 10. Data Fetch Sync
In `fetchCampaign` (line 240-252), after `setCampaign(data)`, **call `setNotesText(data.notes ?? "")`** (sync point 1).

### 11. Click-to-Cycle Status Badge (Buildings tab)
Replace per-row `<Select>` dropdown (lines 734-753) with a clickable Badge. The TableCell wrapping the badge must have `onClick={(e) => e.stopPropagation()}` on the cell itself to prevent the collapsible row from toggling on badge clicks:

```tsx
<TableCell onClick={(e) => e.stopPropagation()}>
  {canEdit ? (
    <Badge
      className={`cursor-pointer ${BUILDING_STATUS_COLORS[b.inspection_status] ?? ""}`}
      onClick={() => handleStatusBadgeClick(b)}
    >
      {BUILDING_STATUS_OPTIONS.find(s => s.value === b.inspection_status)?.label ?? b.inspection_status}
    </Badge>
  ) : (
    <Badge className={BUILDING_STATUS_COLORS[b.inspection_status] ?? ""}>
      {BUILDING_STATUS_OPTIONS.find(s => s.value === b.inspection_status)?.label ?? b.inspection_status}
    </Badge>
  )}
</TableCell>
```

### 12. Preserved Features (no changes)
- Collapsible row detail (BuildingDetail) -- unchanged
- Floating bulk action bar -- unchanged
- Filters (status, inspector, search, priority toggle) -- unchanged
- Export button -- unchanged
- Comments section -- stays in Buildings tab
- Auto-sync campaign totals -- unchanged
- SortableHead helper -- unchanged
