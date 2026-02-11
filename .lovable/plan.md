

# Rename Settings to Buildings, Create Real Settings Page, Clean Up Dead Routes

## 1. Rename current Settings page to DataManager

**File: `src/pages/Settings.tsx` -> `src/pages/DataManager.tsx`** (create new, delete old)

- Create `src/pages/DataManager.tsx` with the same tabbed content
- Change export name from `Settings` to `DataManager`
- Change heading to "Buildings & Data"
- Change subtitle to "Manage building data, access codes, and inspector assignments"

## 2. Create new `src/pages/Settings.tsx`

A real preferences page with three Card sections, all persisted to localStorage:

**Inspector Profile**
- Select dropdown fetching inspectors from Supabase (same query as MyRoutes: `inspectors` table with `regions(name)` join)
- Shows "Name -- Region" format
- Stores selected ID in `roofroute_inspector_id`
- Pre-selects saved value on mount

**Route Generation Defaults**
- Slider (3-8, step 1) for default buildings per day -> `roofroute_default_buildings_per_day`
- Input for home base zip/address -> `roofroute_default_start_location`

**PDF Export Preferences**
- Input for company name -> `roofroute_company_name`
- Switch for include access codes -> `roofroute_include_codes_in_pdf` (default: true)
- Select for font size (Standard/Large) -> `roofroute_pdf_font_size` (default: "standard")

Each change saves immediately to localStorage. A subtle toast fires once per page visit on first change.

## 3. Update `src/components/AppSidebar.tsx`

- Import `Database` from lucide-react (keep `Settings as SettingsIcon`)
- Update `mainNav` to 4 items:
  - My Routes (`/`, Route icon)
  - Route Builder (`/route-builder`, Route icon)
  - Buildings (`/buildings`, Database icon)
  - Settings (`/settings`, SettingsIcon)

## 4. Update `src/App.tsx`

- Remove imports: `Dashboard`, `UploadPage`, `Codes`, `Inspectors`
- Remove old `Settings` import, add `DataManager` and new `Settings`
- Remove routes: `/dashboard`, `/upload`, `/codes`, `/inspectors`
- Change `/settings` route to use new `Settings`
- Add `/buildings` route using `DataManager`
- Remove `/buildings` old route (was using `Buildings` wrapper -- now uses `DataManager`)

Final routes:
```text
/              -> MyRoutes
/my-routes     -> MyRoutes
/route-builder -> RouteBuilder
/buildings     -> DataManager
/settings      -> Settings
*              -> NotFound
```

## 5. Delete orphaned page files

- Delete `src/pages/Dashboard.tsx`
- Delete `src/pages/Upload.tsx`

Keep `Buildings.tsx`, `Codes.tsx`, `Inspectors.tsx` (they export Content components used by DataManager).

## Technical Details

### localStorage helper pattern
```typescript
const getSetting = (key: string, fallback: string) =>
  localStorage.getItem(key) ?? fallback;
```

### Inspector fetch (same as MyRoutes)
```typescript
const { data } = await supabase
  .from("inspectors")
  .select("id, name, regions(name)")
  .order("name");
```

### Toast-once pattern
```typescript
const hasToasted = useRef(false);
const saveSetting = (key: string, value: string) => {
  localStorage.setItem(key, value);
  if (!hasToasted.current) {
    toast.success("Settings saved");
    hasToasted.current = true;
  }
};
```
