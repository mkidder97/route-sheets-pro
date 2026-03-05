

## Photo Grid Redesign Plan

### Current State
The photo management is already a **separate final step** called "PHOTO GRID (N)" with a table/list layout (4-column grid: #, thumbnail, description input, action buttons). All core operations work: upload, delete with renumber, reorder with arrows, full-screen preview, empty state.

### What Needs to Change

**1. Merge photos into COMPLETION & SCHEDULE step (remove separate step)**
- Remove `"PHOTO GRID (${photos.length})"` from `staticStepsAfter`, leaving only `"COMPLETION & SCHEDULE"`
- The completion/schedule step becomes the last step
- Append a "Photos" section at the bottom of the completion/schedule `renderStep()` block (after Internal Notes)
- Update `isPhotoStep` logic to point to this merged last step

**2. Convert layout from table rows to 2-column grid**
- Replace the `grid-cols-[40px_60px_1fr_88px]` list layout with a `grid grid-cols-2 gap-3` layout
- Each cell: rounded card with thumbnail filling the top, photo number badge overlaid top-left (`#1`), trash icon top-right, label text below in small text (or "Unlabeled" in `text-slate-500`)
- Thumbnail is tappable (opens full-screen viewer)
- Remove inline description input from grid cells (descriptions stay editable in full-screen viewer or are removed per spec -- spec says grid shows only number + label)

**3. Reorder via up/down arrows per cell**
- Keep existing `handleReorder` logic with ArrowUp/ArrowDown buttons at the bottom of each cell (since long-press drag is unreliable in React without heavy libs)

**4. Update empty state text**
- Change to: "No photos yet — use the camera button to add photos." with Camera icon

**5. Photo count on step indicator**
- Change the step name for COMPLETION & SCHEDULE to include photo count badge, e.g. append `(📷 ${photos.length})` when photos exist
- This shows in the TOC drawer and top bar

**6. Step name update in `staticStepsAfter`**
```typescript
const staticStepsAfter = [`COMPLETION & SCHEDULE`];
```
The step title in the TOC will dynamically show the photo count.

### Files Modified
- `src/pages/field/cm/CMVisitForm.tsx` — restructure step definitions, move photo grid into completion step, convert to 2-col layout

### No Changes To
- FAB button, label modal, hidden inputs, photo upload logic, delete/reorder logic, full-screen preview overlay

