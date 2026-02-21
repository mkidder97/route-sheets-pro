

# Ops Dashboard — Full Build

## Overview

Replace the stub `OpsDashboard.tsx` with a data-rich dashboard featuring 4 summary cards, active campaign progress rings, a CM pipeline stacked bar chart, and a live activity feed. All data fetched via React Query with 30-second stale time.

---

## File: `src/pages/ops/OpsDashboard.tsx` (complete rewrite)

---

## Section 1: Summary Cards (Top Row)

Responsive grid: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`

Each card is a `Card` with a left border accent (`border-l-4` with `#1B4F72`), a large number, subtitle text, and click handler via `useNavigate`.

| Card | Query | Subtitle | Click |
|------|-------|----------|-------|
| Active Campaigns | `inspection_campaigns` where `status = 'active'` | Sum of `total_buildings` | `/ops/jobs` |
| CM Jobs In Flight | `cm_jobs` where `status != 'complete'` | Priority breakdown (e.g. "3 urgent, 12 normal") | `/ops/jobs` |
| Completed This Week | `campaign_buildings` where `completion_date` between current week's Monday and Sunday (via `startOfWeek`/`endOfWeek` from date-fns, `weekStartsOn: 1`) | "this week" label | `/ops/jobs` |
| Needs Attention | Join: get active campaign IDs, then `campaign_buildings` not complete/skipped, then check `buildings` for `requires_advance_notice = true` | "require advance notice" | `/ops/jobs` |

All queries use `useQuery` with `staleTime: 30_000`.

---

## Section 2: Market Overview (Second Row)

Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

Query active campaigns. For each, also fetch first `campaign_buildings` inspector via a separate query.

Each card shows:
- Campaign name (bold)
- SVG circular progress ring (two `<circle>` elements -- background track + colored arc using `stroke-dashoffset`)
- Percentage text centered in the ring
- Inspector name below

Click navigates to `/ops/jobs/campaign/${id}`.

---

## Section 3: CM Pipeline (Third Row)

Two queries:
1. `cm_job_types` -- get the first active job type and its `statuses` array for colors/labels
2. `cm_jobs` for that job type -- group by status client-side to get counts

Additionally query `cm_job_status_history` to detect "stuck" jobs (latest status change > 7 days ago).

Render using recharts `BarChart` with `layout="vertical"`, a single data row, and one `Bar` per status with `fill` from status color. Each segment labeled with name + count. Stuck count shown as a warning badge next to the chart title.

---

## Section 4: Recent Activity (Fourth Row)

Query `activity_log` (20 rows, ordered by `created_at desc`). Separately fetch `user_profiles` for the unique `user_id` values, merge client-side.

Display as a scrollable list inside a `Card` with `ScrollArea` (max-h-80): each row shows "[full_name] [action] [entity_type] -- [relative time]" using `formatDistanceToNow`.

Uses `refetchInterval: 30_000` for auto-refresh.

---

## Imports

- `useQuery` from `@tanstack/react-query`
- `useNavigate` from `react-router-dom`
- `supabase` from `@/integrations/supabase/client`
- `Card, CardContent, CardHeader, CardTitle` from `@/components/ui/card`
- `Badge` from `@/components/ui/badge`
- `ScrollArea` from `@/components/ui/scroll-area`
- `Skeleton` from `@/components/ui/skeleton`
- `BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell` from `recharts`
- `startOfWeek, endOfWeek, format, formatDistanceToNow` from `date-fns`
- `Activity, Building2, ClipboardList, AlertTriangle, TrendingUp` from `lucide-react`

---

## Loading States

Each section shows `Skeleton` placeholders while its query is pending -- 4 skeleton cards for top row, skeleton rectangles for other sections.

---

## Technical Notes

| Item | Detail |
|------|--------|
| No migrations needed | All tables already exist with appropriate RLS |
| React Query | All queries: `staleTime: 30_000`; activity feed adds `refetchInterval: 30_000` |
| Progress ring | Pure SVG, no extra library |
| Pipeline chart | recharts `BarChart` (already installed) |
| Stuck detection | Query `cm_job_status_history`, find max `created_at` per `cm_job_id`, compare to `now - 7 days` |
| Single file | Everything in `OpsDashboard.tsx` |

