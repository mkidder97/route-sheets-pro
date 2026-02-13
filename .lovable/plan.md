

# Enhanced New Campaign Dialog + Campaign Detail Page

## Overview

Two additions to the Job Board:
1. Improve the "New Campaign" dialog to auto-fill the name and auto-populate building counts on creation
2. Add a new Campaign Detail page at `/ops/jobs/campaign/:id` with a full buildings table, filters, expandable rows, and editable status

## 1. Update `src/pages/ops/OpsJobBoard.tsx` -- Enhanced New Campaign Dialog

### Changes to the dialog:
- Reorder fields: Client first, then Region, then Campaign Name
- Auto-fill Campaign Name as "[Client Name] -- [Region Name]" when both are selected (user can still edit)
- Remove the Status dropdown from the dialog (new campaigns always start as "active")
- On submit: after inserting the campaign, query `buildings` where `client_id` and `region_id` match. Count total rows and rows where `inspection_status = 'complete'`. Update the new campaign record with those counts.

### Changes to the card grid:
- Wrap each card in a click handler that navigates to `/ops/jobs/campaign/${c.id}` using `useNavigate`

## 2. New file: `src/pages/ops/OpsCampaignDetail.tsx`

### Header section:
- Back button (arrow left, navigates to `/ops/jobs`)
- Campaign name (large heading)
- Client -- Region subtitle
- Status badge as an editable `Select` dropdown for admin/office_manager; read-only badge for others
- Date range text
- Progress bar with "X of Y buildings complete (Z%)"

### Filter bar above table:
- Status dropdown (pending, in_progress, complete, skipped, needs_revisit)
- Inspector dropdown (from inspectors table)
- Search input (filters by property_name or address)
- "Priority Only" toggle switch

### Buildings table:
- Fetches buildings where `client_id` and `region_id` match the campaign
- Joins inspectors table via `inspector_id` for inspector name
- Columns: Stop #, Property Name, Address (city, state), Status (color-coded badge), Inspector, Scheduled Week, Flags (star/bell/person icons)
- Sortable by clicking column headers (client-side sort)
- Clickable rows expand inline to show full detail panel

### Expanded row detail:
Shows all building fields in a structured layout:
- Full address (address, city, state, zip_code)
- Building code, roof group, square footage
- Roof access: type, description, access location, lock/gate codes
- Property manager: name, phone, email
- Special notes, special equipment list
- Inspector notes, completion date
- Photo URL (as clickable link if present)

### Status badge colors:
- pending = gray
- in_progress = blue
- complete = green
- skipped = red
- needs_revisit = orange

## 3. Update `src/App.tsx` -- Add route

Add a new child route under `/ops`:
```text
<Route path="jobs/campaign/:id" element={<OpsCampaignDetail />} />
```

## Files

| File | Action |
|------|--------|
| `src/pages/ops/OpsJobBoard.tsx` | Edit -- enhanced dialog with auto-name and building count sync, card click navigation |
| `src/pages/ops/OpsCampaignDetail.tsx` | New -- full campaign detail page with buildings table |
| `src/App.tsx` | Edit -- add campaign detail route |

## Technical Details

| Item | Detail |
|------|--------|
| Files modified | 2 |
| Files created | 1 |
| No database changes | Building counts populated via client-side queries on campaign creation |
| UI components | Table, Collapsible, Select, Switch, Badge, Progress, Input, Button |
| Data joins | buildings -> inspectors (for inspector name column) |
| Navigation | useNavigate for card click and back button |
| Role check | useAuth().role for conditional edit controls |

