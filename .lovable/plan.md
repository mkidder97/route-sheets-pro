

# Photo Grid Step + Submit Visit

## Summary
Replace the photo grid placeholder (last step) with a full photo management UI and wire up the Submit Visit button. Single file change: `CMVisitForm.tsx`.

## Changes — `src/pages/field/cm/CMVisitForm.tsx`

### 1. New state and data fetching
- Add `photos` state array typed as `CmPhoto[]` (`id, cm_visit_id, photo_number, description, storage_path, public_url, sort_order`)
- Add `uploading` boolean state
- Fetch `cm_photos` for this visit in the initial `fetchData`, ordered by `sort_order`
- Add `photoInputRef` for the hidden file input

### 2. Photo operations

**Upload**: Hidden `<input type="file" accept="image/*" capture="environment">`. On file select:
1. Generate UUID filename, upload to `cm-reports/visits/{visitId}/{uuid}.jpg`
2. Get public URL via `getPublicUrl()`
3. INSERT into `cm_photos` with `photo_number = MAX(photo_number) + 1` (not count — handles deletions), `sort_order = photos.length`
4. Append to local state. Show `uploading` spinner during upload.

**Delete**: Confirm dialog → DELETE from `cm_photos` AND `supabase.storage.from('cm-reports').remove([path])`. Remove from local state and renumber all remaining photos sequentially.

**Reorder (up/down arrows)**: Swap `sort_order` between adjacent items, renumber `photo_number` 1-N for all rows, batch UPDATE all rows, update local state.

**Description edit**: Inline `<Input>` with 1500ms debounced save to `cm_photos.description`.

### 3. Photo grid step rendering
- Step title in `staticStepsAfter` becomes dynamic: `PHOTO GRID (${photos.length})` — update `allSteps` computation
- Table-style list: Photo # | 60x60 thumbnail (rounded, tap for full-screen overlay) | Description input | Up/Down/Trash actions
- Full-screen overlay: dark bg, centered image, left/right nav, close button
- Empty state: "No photos yet. Tap Add Photo to get started."
- "Add Photo" button at bottom: full-width blue on mobile

### 4. Top bar + icon shortcut
- When on the photo step, show a `Plus` icon button in the top bar (right side, before save indicator) that triggers the same file input

### 5. Submit Visit flow
- When `isLastStep` and not `isSubmitted`: Submit Visit button is enabled (primary blue)
- On tap:
  1. Check `overview_narrative`, `photos.length`, `src_associate_id` — if any empty, show warning toast (non-blocking via sonner)
  2. Show confirmation AlertDialog: "Submit Visit #N?" / "This cannot be undone."
  3. On confirm: UPDATE `cm_visits SET status='submitted', submitted_at=now()` → navigate to `/field/cm/{projectId}` → success toast
- After submission: existing `isSubmitted` logic already disables all inputs and shows the banner

### 6. Imports
Add: `Plus, Trash2, ArrowUp, ArrowDown, X, Camera` from lucide-react. `AlertDialog` components from shadcn. `toast` from sonner.

## Files
1. **Modified**: `src/pages/field/cm/CMVisitForm.tsx`

No database or storage changes needed — `cm_photos` table and `cm-reports` bucket already exist.

