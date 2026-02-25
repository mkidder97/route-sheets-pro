

# Build the Dashboard Page

## Summary

Replace the placeholder `src/pages/Dashboard.tsx` with a real dashboard showing greeting, stats, active campaigns with progress bars, and recent activity.

## Single File Change: `src/pages/Dashboard.tsx`

### Layout

```text
+--------------------------------------------------+
| Good morning, [First Name]                       |
| Wednesday, February 25, 2026                     |
+--------------------------------------------------+
| Active    | Buildings  | Priority  | Total       |
| Campaigns | Complete   | Pending   | Portfolio   |
|    3      | 45/120(38%)| 12        | 120         |
+--------------------------------------------------+
| Active Campaigns        | Recent Activity        |
| [Campaign Card w/       | - Status Changed ...   |
|  progress bar]          | - Building Added ...   |
| [Campaign Card]         | - Campaign Created ... |
+--------------------------------------------------+
```

### Data Fetching (all in a single useEffect on mount)

1. **Stats** -- 4 separate Supabase queries:
   - `inspection_campaigns` count where `status = 'active'`
   - `buildings` select `id, inspection_status, is_priority` (client-side count complete, priority pending, total)
2. **Active Campaigns** -- `inspection_campaigns` where `status = 'active'`, order by `start_date` asc, limit 5, with `clients(name)` join
3. **Recent Activity** -- `activity_log` order by `created_at` desc, limit 10

### UI Components Used

- `Card`, `CardContent` from shadcn
- `Progress` from shadcn (for campaign progress bars)
- `useAuth()` for `profile.full_name`
- `useNavigate` for campaign card click -> `/inspections/campaigns/:id`
- `format` from date-fns for header date
- `formatDistanceToNow` from date-fns for activity timestamps
- Lucide icons: `ClipboardCheck`, `Building2`, `AlertTriangle`, `Briefcase` for stat cards

### Formatting Details

- Greeting uses time-of-day: morning/afternoon/evening based on current hour
- Activity action names: replace underscores with spaces and title-case (e.g., "status_change" -> "Status Change")
- Stats grid: `grid grid-cols-2 lg:grid-cols-4 gap-4`
- Content grid: `grid grid-cols-1 lg:grid-cols-2 gap-6`

### No other files change

`App.tsx`, `UnifiedLayout.tsx`, and all other files remain untouched. The route `/dashboard` already points to this component.

