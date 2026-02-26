

# Add Photo Upload to RoofSpecsTab

## Summary
Add photo upload and preview capability for `core_photo_url` and `roof_section_photo_url` fields on each roof section, using the existing `building-files` storage bucket. No database migration needed -- both columns already exist on `roof_sections`.

## Changes

All changes are in a single file: `src/components/building/RoofSpecsTab.tsx`

### 1. New imports
- Add `Camera` to the lucide-react import (line 38-49). `Dialog` and related components are already imported.
- Add `useRef` to the React import (line 1 already has `useState, useEffect, useCallback` -- add `useRef`).

### 2. New state and refs (inside the component, around line 63-83)
- `uploadingPhoto` state: `useState<{ sectionId: string; type: 'core' | 'section' } | null>(null)`
- `previewPhoto` state: `useState<{ url: string; title: string } | null>(null)` -- for the full-size image preview dialog
- Two refs: `corePhotoRef = useRef<HTMLInputElement>(null)` and `sectionPhotoRef = useRef<HTMLInputElement>(null)`

### 3. Photo upload handler function (after existing handler functions, ~line 270)
New `handlePhotoUpload` function that:
- Accepts `file: File`, `sectionId: string`, `type: 'core' | 'section'`
- Sets `uploadingPhoto` state
- Extracts file extension from `file.name`
- Builds storage path: `{buildingId}/roof-sections/{sectionId}/{type === 'core' ? 'core' : 'section'}-{Date.now()}.{ext}`
- Uploads to `building-files` bucket via `supabase.storage.from('building-files').upload(path, file)`
- Gets public URL via `supabase.storage.from('building-files').getPublicUrl(path).data.publicUrl`
- Updates `roof_sections` row: sets `core_photo_url` or `roof_section_photo_url` to the public URL
- Calls `loadSections()` to refresh local state
- Shows `toast.success` / `toast.error`
- Clears `uploadingPhoto` state and resets file input value

### 4. Photo thumbnails in view mode -- added to Card 2 (Roof Details)
After the existing grid of spec facts (line 482, before the canWrite edit button), add a new row showing both photo thumbnails side by side:

```text
<div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
  <!-- Core Photo -->
  <div>
    <p className="text-slate-400 text-xs mb-2">Core Photo</p>
    {selected.core_photo_url ? (
      <img onClick -> open previewPhoto dialog
           src={selected.core_photo_url}
           className="w-24 h-24 object-cover rounded-lg cursor-pointer" />
    ) : (
      <placeholder with Camera icon>
    )}
  </div>
  <!-- Section Photo (same pattern) -->
</div>
```

### 5. Photo upload buttons in edit mode -- added to Card 2 (Roof Details)
In the canWrite section of Card 2 (currently just a pencil edit button at line 483-489), add two hidden file inputs and two upload buttons alongside the existing pencil icon:

- Hidden `<input type="file" accept="image/*" ref={corePhotoRef} onChange=...>`
- Hidden `<input type="file" accept="image/*" ref={sectionPhotoRef} onChange=...>`
- Button: ghost, sm, Camera icon, label "Upload Core Photo" or "Replace Core Photo" depending on whether `selected.core_photo_url` exists
- Button: ghost, sm, Camera icon, label "Upload Section Photo" or "Replace Section Photo"
- Show `Loader2` spinner when `uploadingPhoto` matches the current section and type

### 6. Full-size image preview dialog
Add a new `Dialog` at the bottom of the component (alongside existing dialogs, before `</div>` at line 805):

```text
<Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
  <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
    <DialogHeader>
      <DialogTitle>{previewPhoto?.title}</DialogTitle>
    </DialogHeader>
    <img src={previewPhoto?.url} className="w-full rounded-lg" />
  </DialogContent>
</Dialog>
```

## What stays the same
- All existing fields, assembly layers, section CRUD, collapsible cards, edit dialogs, layer dialog, add section dialog -- completely untouched
- No new files, no migrations, no changes to other components
