

# Redesign Expanded Building Card Content

## File: `src/components/SavedRoutes.tsx`

### Change 1 -- Add `Navigation` icon import (line 35)

Add `Navigation` to the existing lucide-react import line.

### Change 2 -- Replace expanded content (lines 413-445)

Replace the flat list of detail lines with an organized layout containing these sections:

1. **Full address** -- city, state, zip on one line
2. **Access Details** -- highlighted box (`bg-accent/50`) with section header, access location text, and codes in bold mono
3. **Equipment** -- inline if present
4. **Special notes** -- muted background box
5. **Property Manager** -- highlighted box with clickable `tel:` and `mailto:` links
6. **Inspector notes** -- muted background box
7. **Navigate button** -- disabled placeholder (`Navigation` icon + "Navigate (coming soon)")
8. **Status dropdown** -- same `Select` as before, kept at the bottom

### What does NOT change

- Collapsed card (rows 1-4) -- untouched
- All handlers, state, day picker, dialogs -- untouched
- `cfg` variable remains defined at the top of the `.map()` callback and is used by both the collapsed Badge and the expanded status dropdown

