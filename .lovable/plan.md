

# Job Board Page with Inspection Campaigns

## Overview

Build the `/ops/jobs` page with an "Annuals" / "CM Jobs" toggle, a new `inspection_campaigns` database table, and a card-based campaign viewer with client/region/status filters.

## 1. Database Migration

Create `inspection_campaigns` table with:

| Column | Type | Details |
|--------|------|---------|
| id | uuid | PK, gen_random_uuid() |
| client_id | uuid | NOT NULL, references clients |
| region_id | uuid | NOT NULL, references regions |
| name | text | NOT NULL |
| start_date | date | NOT NULL |
| end_date | date | NOT NULL |
| status | text | CHECK constraint: planning, active, complete, on_hold. Default 'active' |
| total_buildings | integer | Default 0 |
| completed_buildings | integer | Default 0 |
| notes | text | Nullable |
| created_at / updated_at | timestamptz | Default now(), trigger for updated_at |

RLS policies:
- SELECT: all authenticated users
- INSERT / UPDATE / DELETE: admin or office_manager (via `has_ops_role`)

## 2. Rewrite `src/pages/ops/OpsJobBoard.tsx`

### Top-level layout
- Title "Job Board" on the left, Tabs toggle (Annuals / CM Jobs) on the right
- CM Jobs tab shows a "Coming Soon -- Phase 2" placeholder

### Annuals tab
- **Filter bar**: Client dropdown (from clients table), Region dropdown (filtered by selected client, resets when client changes), Status dropdown, and a "New Campaign" button (admin/office_manager only)
- **Campaign card grid**: Responsive grid (1/2/3 columns) of cards, each showing:
  - Campaign name
  - Client -- Region subtitle
  - Status badge (planning=gray, active=blue, complete=green, on_hold=orange)
  - Date range formatted with date-fns
  - Progress bar with "X / Y buildings" and percentage
  - Cards have cursor-pointer and hover shadow (no navigation target yet)
- **Empty state**: "No campaigns found. Create your first campaign to get started."

### New Campaign dialog
- Fields: Campaign Name, Client (select), Region (select, filtered by client), Start Date, End Date, Status, Notes (optional)
- Inserts directly via Supabase client into `inspection_campaigns`
- total_buildings and completed_buildings both start at 0 (auto-sync comes in Phase 1.2)

## Files

| File | Action |
|------|--------|
| New migration SQL | Create `inspection_campaigns` table + RLS |
| `src/pages/ops/OpsJobBoard.tsx` | Full rewrite with tabs, filters, cards, dialog |

## Technical Details

| Item | Detail |
|------|--------|
| New table | `inspection_campaigns` |
| RLS | Authenticated read, admin/office_manager write |
| UI components | Tabs, Card, Badge, Progress, Select, Dialog, Input, Textarea, Button |
| Data fetching | Direct Supabase queries with filters |
| Date formatting | date-fns `format()` |

