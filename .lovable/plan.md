

# Add "Office Mode" Toggle to FieldLayout

## Problem
There's no way to navigate back from the field interface to the office/desktop interface. The two layouts each need a toggle to switch to the other.

## Approach
Mirror the pattern already used in `UnifiedLayout.tsx` — add a small icon button to FieldLayout's top header bar that navigates back to `/dashboard`.

### FieldLayout.tsx changes
- Add a `Monitor` (or `LayoutDashboard`) icon button labeled "Office" in the header, positioned between the user name and the sign-out button (or to the left of the user name).
- Only visible to roles that have access to the office interface (`admin`, `office_manager`, `field_ops`, `engineer`). Inspectors and construction managers who are office-only field users won't see it unless they also have office access — but since `admin` sees both, it makes sense to show it for `admin`, `office_manager`, `field_ops`, and `engineer`. For `inspector` and `construction_manager`, they can still navigate via URL but the button won't clutter their simpler UI.
- Actually, the simplest and best approach: show it to **all authenticated users**. Anyone in field mode should be able to get back. The `ProtectedRoute` on office routes will handle access control anyway.
- Uses `useNavigate()` (already available in the component) to go to `/dashboard`.

### Implementation
Add to FieldLayout header, before the user name span:

```tsx
<button onClick={() => navigate("/dashboard")} className="..." aria-label="Office mode">
  <Monitor className="h-4 w-4" />
  <span className="hidden sm:inline text-xs">Office</span>
</button>
```

One file changed: `src/components/FieldLayout.tsx`. No other files affected.

