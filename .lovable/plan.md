

# Surface Quick Actions on Collapsed Cards — Final Plan

## Overview
Add "Navigate" and "Done" buttons on every collapsed building card (both Day View and Proximity View) so inspectors can act with one tap. Dim completed buildings visually.

## Changes (single file: `src/components/SavedRoutes.tsx`)

### 1. Day View — Dim completed cards (line 1133)
Add conditional `opacity-50` to card container. Opacity is **cosmetic only** — the card and all its buttons remain fully interactive.
```
className={`rounded-md bg-background border overflow-hidden ${
  b.inspection_status === "complete" ? "opacity-50" : ""
} ${bulkMode && isSelected ? "border-primary" : "border-border"}`}
```

### 2. Day View — Quick Actions Row (between line 1211 and 1212)
Insert a new `<div>` after `</button>` (line 1211) and before the expanded section (line 1212). Placed **outside** the `<button>` element for clean semantics. **Hidden when `bulkMode` is true** — the bulk action bar replaces individual card actions.

```tsx
{!bulkMode && (
  <div className="flex items-center gap-2 px-3 pb-3 pt-2 border-t border-border/50">
    <Button size="sm" variant="outline" className="h-9 px-3 flex-1"
      onClick={(e) => {
        e.stopPropagation();
        openNavigation(b.address, b.city, b.state, b.zip_code);
      }}>
      <Navigation className="h-4 w-4 mr-1.5" /> Navigate
    </Button>
    {b.inspection_status !== "complete" ? (
      <Button size="sm"
        className="h-9 px-4 bg-success text-success-foreground hover:bg-success/90"
        disabled={saving}
        onClick={(e) => {
          e.stopPropagation();
          handleStatusChange(b.id, "complete");
        }}>
        <Check className="h-4 w-4 mr-1.5" /> Done
      </Button>
    ) : (
      <Badge className="bg-success/20 text-success border-0 h-9 px-3 flex items-center text-xs">
        <Check className="h-3.5 w-3.5 mr-1" /> Complete
      </Badge>
    )}
  </div>
)}
```

### 3. Proximity View — Dim completed cards (line 841)
Same opacity treatment:
```
className={`rounded-md bg-background border border-border overflow-hidden ${
  b.inspection_status === "complete" ? "opacity-50" : ""
}`}
```

### 4. Proximity View — Quick Actions Row (between line 894 and 895)
Same quick actions row inserted after `</button>` and before expanded section. No `bulkMode` guard needed here since bulk mode only applies to the day view.

### 5. Expanded view — No changes
Skip/Revisit with notes and full details remain untouched.

## Key Behavioral Rules

- **Bulk mode hides quick actions**: When `bulkMode` is true in the day view, Row 5 is hidden entirely. Checkboxes and the sticky bulk bar handle all actions.
- **Opacity is cosmetic, not disabled**: Completed cards at `opacity-50` still have fully functional Navigate buttons. Inspectors may need to navigate back to a completed building. The Done button swaps to a static "Complete" badge, but Navigate remains clickable.
- All action buttons use `e.stopPropagation()` so they never trigger card expand/collapse.

## Technical Notes
- `Navigation`, `Check` icons already imported
- `openNavigation` helper exists at line 208
- `handleStatusChange` exists and handles the complete status update
- `saving` state available for disabling buttons
- No new state, no new files, no database changes

