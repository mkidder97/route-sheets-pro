

## Filter CM Jobs to Inspector's Assigned Projects

### Changes in `src/pages/field/cm/CMProjectsList.tsx`

**1. Import `useAuth`** — add `import { useAuth } from "@/hooks/useAuth";` at line 1.

**2. Get user from auth** — add `const { user } = useAuth();` after `const [search, setSearch] = useState("");` (line 11).

**3. Replace the query (lines 13-44)** with a filtered version that:
- Includes `user?.id` in the query key and `enabled: !!user?.id`
- First queries `cm_visits` for `cm_project_id` values where `inspector_id = user.id`
- Deduplicates project IDs, returns `[]` if none
- Fetches only those projects from `cm_projects` with visit counts

**4. Update empty state text (line 77)** — change `"No active projects"` to `"No projects assigned to you yet."`

### Files Modified
- `src/pages/field/cm/CMProjectsList.tsx` — query logic + empty state text only

### Not Changed
- Navigation, card layout, search filter, or any other component

