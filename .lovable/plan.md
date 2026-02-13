

# Settings Revamp + CAD Screenshot Upload with Square Footage Parsing

## Overview

Three changes: (1) rebuild the Settings page with field-relevant preferences (no light mode, no PDF), (2) add a CAD screenshot upload feature on each building card that marks the inspection as fully complete and stores the image, and (3) use Tesseract.js to OCR the uploaded CAD screenshot and extract square footage to cross-check against the building's stored value.

---

## Part 1: Settings Page Revamp

Remove the Inspector Profile card (already on My Routes) and the entire PDF Export card. Keep Route Defaults, add Field Preferences.

### New Layout

**Card 1: Route Defaults** (keep as-is)
- Default buildings per day slider
- Home base / starting location

**Card 2: Field Preferences** (new)
- **Preferred navigation app**: Dropdown with Auto (current iOS/Android detection), Google Maps, Apple Maps, Waze. Stored as `roofroute_nav_app` in localStorage.
- **Auto-hide completed buildings**: Toggle (default off). Stored as `roofroute_auto_hide_complete`. Pre-sets the hide filter when opening a route.
- **Confirm before status change**: Toggle (default off). Stored as `roofroute_confirm_status`. When enabled, tapping Done/Skip/Revisit shows a quick confirm before saving.

### File: `src/pages/Settings.tsx`
- Remove inspector state, PDF state, and their UI cards
- Add nav app, auto-hide, and confirm-status state and controls

### File: `src/components/SavedRoutes.tsx`
- Update `openNavigation()` to read `roofroute_nav_app` from localStorage and build the correct URL (Google Maps, Apple Maps, or Waze deep link)
- Initialize `hideComplete` from `roofroute_auto_hide_complete` localStorage value
- Read `roofroute_confirm_status` and wrap status change actions in a confirm dialog when enabled

---

## Part 2: CAD Screenshot Upload + Auto-Complete

Add a CAD upload button to each building card's expanded view. Uploading a CAD screenshot stores the file, marks the building as "complete," and runs OCR to validate square footage.

### User Flow

1. Inspector expands a building card in SavedRoutes
2. Sees a prominent **"Upload CAD"** button (camera icon) alongside the status buttons
3. Taps it, selects/takes a screenshot of the CAD drawing
4. App uploads the image to storage, saves the URL to `buildings.photo_url`
5. Runs Tesseract.js on the image to extract text, searches for square footage numbers
6. If a square footage value is found:
   - Compares it to the building's stored `square_footage`
   - If they match (within 10% tolerance): shows a success toast ("CAD uploaded -- 12,500 SF confirmed")
   - If they differ: shows a warning toast ("CAD shows 14,200 SF but building has 12,500 SF -- please verify") and does NOT auto-update the DB value (leaves it for manual review)
   - If no SF found in the image: uploads silently with a neutral toast
7. Auto-sets `inspection_status` to "complete"
8. Building card now shows a small CAD icon/badge indicating the drawing is attached
9. Tapping the badge opens the image in a preview dialog

### "Needs CAD" Filter

In the route plan header area (next to the existing hide-complete toggle), add a **"Needs CAD"** filter toggle. When enabled, only shows buildings that are marked complete but have no `photo_url` -- these are buildings the inspector finished in the field but hasn't uploaded the CAD for yet. This replaces the batch email workflow.

### Technical Details

**New dependency**: `tesseract.js` for client-side OCR

**Storage bucket** (database migration):
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('cad-drawings', 'cad-drawings', true);
CREATE POLICY "Public upload cad drawings" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cad-drawings');
CREATE POLICY "Public read cad drawings" ON storage.objects FOR SELECT USING (bucket_id = 'cad-drawings');
```

**Square footage parsing logic** (in SavedRoutes.tsx):
- After Tesseract extracts text from the CAD screenshot, search for patterns like:
  - `12,500 SF`, `12500 sq ft`, `12,500 square feet`, `12500 sqft`
  - Regex: `/(\d[\d,]*)\s*(?:sf|sq\.?\s*ft|square\s*feet|sqft)/i`
- Parse the first match, strip commas, compare to `building.square_footage`
- Tolerance: within 10% counts as a match

**File changes in `src/components/SavedRoutes.tsx`**:
- Add hidden file input for image capture (`.png, .jpg, .jpeg`)
- New state: `cadUploading` (building ID or null), `cadPreview` (URL or null for preview dialog)
- Upload handler: uploads to `cad-drawings/{buildingId}/{timestamp}.jpg`, updates `buildings.photo_url`, sets status to complete, runs OCR check
- Add CAD badge on building cards when `photo_url` exists (fetch it alongside other building data)
- Add "Needs CAD" toggle in the route header
- Add CAD preview dialog

**Data fetch update**: The existing query in `toggleExpand` already selects from `buildings(...)`. Add `photo_url` to the select list and to the `SavedDayBuilding` interface.

---

## Summary of All Changes

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Rewrite: remove inspector/PDF cards. Add nav app, auto-hide, confirm status settings |
| `src/components/SavedRoutes.tsx` | (1) Add `photo_url` to interface and data fetch. (2) Upload CAD button on building cards. (3) Tesseract OCR for SF validation. (4) CAD badge + preview dialog. (5) "Needs CAD" filter toggle. (6) Nav app preference in openNavigation(). (7) Auto-hide from localStorage. (8) Confirm-before-status-change. |

### Database migration
- Create `cad-drawings` storage bucket with public read/insert policies

### New dependency
- `tesseract.js` for client-side OCR (no server/AI calls)

### No schema changes to tables
- Uses existing `buildings.photo_url` column for CAD URL
- Uses existing `inspection_status` column

