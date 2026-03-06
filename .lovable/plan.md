

## Rebuild Contacts Page — Buildings-Sourced Property Manager Contacts

### Summary
Replace the empty `contacts` table query with a buildings query, deduplicate by email, and render as a card grid with collapsible building lists. Remove all CRUD (add/edit/delete) functionality — page becomes read-only.

### Changes (single file: `src/pages/Contacts.tsx`)

**1. Replace imports**
- Remove: `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `DialogDescription`, `Label`, `Textarea`, `Button` (partially — keep if needed), `Plus`, `Pencil`, `Trash2`, `useAuth`
- Add: `Card`, `CardContent` from `@/components/ui/card`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible`, `Mail`, `Phone`, `ChevronDown`, `Building2` from `lucide-react`, `Badge` from `@/components/ui/badge`

**2. Replace data model**
- Remove `Contact` interface, `emptyForm`, all CRUD state (`dialogOpen`, `editingId`, `form`, `saving`, `deleteId`, `canWrite`)
- New interface:
```ts
interface PMContact {
  email: string;
  name: string;
  phone: string | null;
  clientName: string | null;
  clientId: string | null;
  buildings: string[]; // property_name values
}
```

**3. Replace data fetch**
- Query `buildings` table with `.select("id, property_name, property_manager_name, property_manager_email, property_manager_phone, client_id, region_id, clients(name), regions(name)")` filtered by `.not("property_manager_email", "is", null)`
- Still fetch clients for the filter dropdown
- After fetch, deduplicate: group by `property_manager_email`, aggregate building names, take first non-null name/phone/client per email group
- Store as `PMContact[]`

**4. Filter logic**
- Search matches on `name` or `email`
- Client filter matches on `clientId`

**5. UI: Card grid**
- `grid grid-cols-1 md:grid-cols-2 gap-4`
- Each card (dark theme: `bg-slate-800 border-slate-700/50 rounded-xl`):
  - PM name (`text-slate-100 font-semibold`)
  - Email as `mailto:` link with Mail icon
  - Phone as `tel:` link with Phone icon (if present)
  - Client name badge
  - Collapsible section: "{N} buildings" trigger, expands to list property names

**6. Remove all CRUD UI**
- Delete the Add/Edit dialog, Delete confirmation dialog, action buttons, `canWrite` logic entirely

### No schema changes, no new files.
