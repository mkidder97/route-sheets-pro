

## Active Campaign Banner on Field Home

### Changes in `src/pages/field/FieldHome.tsx`

**1. Imports (lines 5-6)** — add `ClipboardCheck` to lucide imports, add `Progress` import.

**2. New query (after line 33)** — add `useQuery` with key `["field-campaign-banner", user?.id]` that chains: `user_profiles.inspector_id` → `inspectors.region_id` → `inspection_campaigns` where `status = 'active'`, limit 1.

**3. Banner JSX (between line 45 and line 47)** — render a card when campaign data exists:
- `bg-slate-800 border border-slate-700/50 rounded-xl p-4`
- ClipboardCheck icon in blue tint + "Active Campaign" label
- Campaign name, Progress bar, completion count, date range
- Informational only, not clickable

### Files Modified
- `src/pages/field/FieldHome.tsx`

