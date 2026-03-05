

## Expandable Building Cards in FieldInspections.tsx

### Single file change: `src/pages/field/FieldInspections.tsx`

**Imports to add:**
- `ChevronDown, ChevronUp, Phone, Mail, Navigation` to lucide-react imports
- `Button` from `@/components/ui/button`

**New state:**
- `expandedBuildingId: string | null` (default `null`)

**Query change (line 65):**
Update select string to:
```
"id, property_name, address, city, state, roof_access_type, lock_gate_codes, special_notes, square_footage, access_location, special_equipment, property_manager_name, property_manager_phone, property_manager_email, inspector_notes, roof_access_description, clients(name), regions(name)"
```

**Card replacement (lines 224-242):**
Replace static cards with expandable cards:

- **Collapsed state**: property name + access type badge, address line, lock codes with key emoji in mono, ChevronDown/Up icon bottom-right
- **Expanded state** (toggled by clicking header): divider + detail grid showing Client, Region, Sq Footage, Roof Access, Access Location, Access Description, Lock/Gate Codes, Equipment, Special Notes, Inspector Notes (bg-slate-900/60 block), PM contact section with tappable tel:/mailto: links, and a full-width Navigate button opening Google Maps directions
- Toggle logic: `expandedBuildingId === b.id` toggles on click

All styling stays dark theme consistent (`bg-slate-800/50`, `border-slate-700/50`).

