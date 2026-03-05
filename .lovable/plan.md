

## FAB Photo Capture with Label Modal — CMVisitForm.tsx

### Overview
Add a floating action button (FAB) visible on every step (except submitted) that lets inspectors capture/upload photos from any step, with a label+note modal before saving.

### New State & Refs
- `fabSheetOpen` (boolean) — bottom sheet with Take Photo / Upload options
- `takePhotoRef`, `uploadPhotoRef` — two hidden file inputs (one with `capture="environment"`, one without, with `multiple`)
- `labelQueue` — `File[]` queue of photos awaiting labeling
- `currentLabelFile` — current file being labeled
- `labelModalOpen` (boolean)
- `selectedLabel` — string or null
- `newLabelText` — string for custom label input
- `photoNote` — string for the note field

### CmPhoto Interface Update
Add `label?: string | null` to the `CmPhoto` interface (line 80-88).

### VisitData Interface Update
Add `custom_photo_labels?: string[]` to match the new DB column.

### FAB Button
- Positioned `fixed bottom-20 right-4 z-50` (above the bottom nav bar which is ~56px)
- Teal circular button: `rounded-full w-14 h-14 bg-teal-600 hover:bg-teal-700 shadow-lg`
- Camera icon, white
- Hidden when `isSubmitted`

### Bottom Sheet (on FAB tap)
Use the existing `Sheet` component with `side="bottom"`:
- "Take Photo" row — triggers `takePhotoRef.click()` (has `capture="environment"`)
- "Upload from Camera Roll" row — triggers `uploadPhotoRef.click()` (has `multiple`, no capture)
- Close sheet after selection

### Label Modal Flow
After file(s) selected → populate `labelQueue` → process one at a time:
1. Show `Dialog` with:
   - **Label dropdown**: "Overview", "Detail", "Punch Item", plus any `visit.custom_photo_labels`, plus "+ New Label"
   - If "+ New Label" selected: show text input, on confirm → save to `cm_visits.custom_photo_labels` array via Supabase update, then use as label
   - **Note input**: single-line, placeholder "Add a note...", optional
   - **Skip button**: saves photo with no label/note
   - **Save Photo button**: saves with selected label + note
2. Upload to `cm-reports` bucket at `visits/${visitId}/${uuid}.jpg`
3. Insert into `cm_photos` with `label` and `description` (note) columns
4. Shift to next file in queue, repeat until empty
5. Update `photos` state so stepper title refreshes

### Photo Upload Function
Create `handleFabPhotoUpload(file: File, label: string | null, note: string | null)` that mirrors existing `handlePhotoUpload` but also sets `label` and `description` in the insert payload.

### Existing Logic
- Keep all existing photo grid step upload logic untouched
- The FAB is purely additive
- Photo count in stepper title (`PHOTO GRID (${photos.length})`) auto-updates since it reads from `photos` state

### Files Modified
- `src/pages/field/cm/CMVisitForm.tsx` — all changes in this single file

