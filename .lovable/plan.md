

## Campaign-Grouped Collapsible History

### Single file: `src/pages/field/FieldInspections.tsx`

**Imports**: Add `useMemo` to the React import (line 1). No other import changes needed — `ChevronDown`, `ChevronUp`, `Badge` already imported.

**New state** (after line 20):
- `expandedCampaigns: Set<string>` initialized empty, populated via `useEffect` when `historyItems` loads

**New useMemo** (before return):
- Group `historyItems` by `campaign_name` into `{ campaignName, items, mostRecentDate }[]`
- Sort groups by `mostRecentDate` descending
- Items within each group keep existing `completed_at` desc order from query

**useEffect**: When `historyItems` changes and has data, set `expandedCampaigns` to a Set of all unique campaign names (all start open).

**History tab rendering** (lines 363-379): Replace flat list with:
- Iterate `groupedHistory`, render each group as:
  - Clickable header: campaign name (left) + count Badge (outline) + chevron icon (right), styled `bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2.5`
  - Toggle: add/remove campaign name from `expandedCampaigns` Set
  - When expanded: `space-y-2 mt-2` container with same building cards (property name, address, date)
- Keep all loading/empty states unchanged

