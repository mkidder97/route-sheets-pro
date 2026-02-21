

# Field Ops Enhancements: Navigate, Tappable Contact, Column Header

## Overview

Four changes to improve the field_ops experience on the Campaign Detail page, without altering any existing edit/bulk action gating.

---

## 1. Add "Nav" Column with MapPin Button

### Table Header (line 709)
- After the "Flags" `TableHead`, add: `<TableHead className="w-10">Nav</TableHead>`

### Table Row (after Flags cell, ~line 762)
- Add a new `TableCell` with a ghost button containing a `MapPin` icon
- On click, constructs the address and opens Google Maps directions in a new tab
- Icon styled with `text-primary` for visibility on mobile
- `onClick` uses `e.stopPropagation()` to prevent row expansion

```
<TableCell onClick={(e) => e.stopPropagation()}>
  <Button variant="ghost" size="sm" onClick={() => {
    const addr = encodeURIComponent(`${b.building.address}, ${b.building.city}, ${b.building.state} ${b.building.zip_code}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, "_blank");
  }}>
    <MapPin className="h-4 w-4 text-primary" />
  </Button>
</TableCell>
```

### ColSpan Update (line 767)
- Update the expanded detail `td colSpan` from `canEdit ? 10 : 9` to `canEdit ? 11 : 10` to account for the new column

### Import
- Add `MapPin` to the lucide-react import line

---

## 2. Tappable Phone and Email in BuildingDetail

### Property Manager Phone (line 905)
Replace:
```
<p>{b.property_manager_phone ?? "..."}</p>
```
With:
```
<p>{b.property_manager_phone ? (
  <a href={`tel:${b.property_manager_phone}`} className="text-primary underline">
    {b.property_manager_phone}
  </a>
) : "..."}</p>
```

### Property Manager Email (line 906)
Replace:
```
<p>{b.property_manager_email ?? "..."}</p>
```
With:
```
<p>{b.property_manager_email ? (
  <a href={`mailto:${b.property_manager_email}`} className="text-primary underline">
    {b.property_manager_email}
  </a>
) : "..."}</p>
```

---

## 3. Comments Section

No changes needed. The comments section (lines 779-819) is already visible to all authenticated users and field_ops can post. Confirmed working as-is.

---

## Files

| File | Action |
|------|--------|
| `src/pages/ops/OpsCampaignDetail.tsx` | Add MapPin import, Nav column header + cell, update colSpan, tappable phone/email links |

## Technical Details

| Item | Detail |
|------|--------|
| New import | `MapPin` from lucide-react |
| Navigate button | All users see it (not gated by canEdit) |
| Icon color | `text-primary` for mobile prominence |
| ColSpan | Incremented by 1 for both canEdit and non-canEdit paths |
| Phone/email links | Standard `tel:` and `mailto:` href patterns |
| No gating changes | Existing canEdit checks remain untouched |

