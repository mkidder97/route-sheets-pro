

# Build Functional Pages: Clients, Contacts, Contractors, Warranties, Budgets

## Overview

Replace 5 placeholder "Coming Soon" pages with real CRUD pages. The `clients` table already exists; `contacts` will be created; `contractors`, `warranties`, and `budgets` will use local mock data.

## Role-Gating Pattern

Matches the existing codebase pattern used in `CMJobsBoard.tsx` and `Campaigns.tsx`:

```typescript
import { useAuth } from "@/hooks/useAuth";
// ...
const { role } = useAuth();
const canWrite = role === "admin" || role === "office_manager";
```

`canWrite` gates the Add button, Edit/Delete actions, and dialog visibility.

## Database Changes

### 1. Add columns to `clients`

The existing `clients` table has `contact_name`, `email`, `phone` but lacks `industry`, `website`, `notes`. Add them:

```sql
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS notes text;
```

### 2. Create `contacts` table

```sql
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  title text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Role insert contacts" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (has_ops_role(auth.uid(), 'admin'::ops_role)
           OR has_ops_role(auth.uid(), 'office_manager'::ops_role));
CREATE POLICY "Role update contacts" ON public.contacts
  FOR UPDATE TO authenticated
  USING (has_ops_role(auth.uid(), 'admin'::ops_role)
      OR has_ops_role(auth.uid(), 'office_manager'::ops_role)
      OR has_ops_role(auth.uid(), 'field_ops'::ops_role));
CREATE POLICY "Admin delete contacts" ON public.contacts
  FOR DELETE TO authenticated
  USING (has_ops_role(auth.uid(), 'admin'::ops_role));
```

### 3. No tables for contractors, warranties, budgets

These use local state with mock data and `// TODO` comments.

## Page Implementations (5 files)

All pages follow the same structure as `Buildings.tsx` and `Campaigns.tsx`:

- `useAuth()` for `role` and `canWrite` check
- Loading spinner, search input, optional filter dropdowns
- shadcn `Table` with relevant columns
- Add/Edit `Dialog` (visible only when `canWrite`)
- Delete confirmation (admin/office_manager only)
- `toast` from sonner for success/error feedback
- Empty state when no results

### `src/pages/Clients.tsx`
- **Source**: Supabase `clients` table
- **Columns**: Name, Industry, Primary Contact (`contact_name`), Email, Phone, Active (badge), Actions
- **Filters**: Active/Inactive/All select, search by name
- **Dialog**: name (required), industry, website, contact_name, email, phone, is_active switch, notes

### `src/pages/Contacts.tsx`
- **Source**: Supabase `contacts` table; fetches `clients` for dropdown
- **Columns**: Name, Title, Client (name), Email, Phone, Actions
- **Filters**: Client dropdown, search by name
- **Dialog**: name (required), title, email, phone, client_id (select), notes

### `src/pages/Contractors.tsx`
- **Source**: Local mock data (3 sample rows)
- **Comment**: `// TODO: create contractors table in Supabase`
- **Columns**: Name, Specialty, Phone, Email, Active, Actions
- **Info banner**: "This page uses sample data. Connect to a database table for persistence."

### `src/pages/Warranties.tsx`
- **Source**: Local mock data (3 sample rows)
- **Comment**: `// TODO: create warranties table in Supabase`
- **Columns**: Manufacturer, Product, Coverage, Expiration, Building, Status, Actions

### `src/pages/Budgets.tsx`
- **Source**: Local mock data (3 sample rows)
- **Comment**: `// TODO: create budgets table in Supabase`
- **Columns**: Project Name, Client, Amount, Status, Date, Actions

## Files Modified

| File | Action |
|------|--------|
| `src/pages/Clients.tsx` | Rewrite with full Supabase CRUD |
| `src/pages/Contacts.tsx` | Rewrite with full Supabase CRUD |
| `src/pages/Contractors.tsx` | Rewrite with mock data CRUD |
| `src/pages/Warranties.tsx` | Rewrite with mock data CRUD |
| `src/pages/Budgets.tsx` | Rewrite with mock data CRUD |
| Database migration | Add columns to `clients`, create `contacts` table |

No changes to `App.tsx`, `UnifiedLayout.tsx`, or any other files.
