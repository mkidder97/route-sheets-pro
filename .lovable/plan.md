

## Add Back Button to CMVisitForm Top Bar

### Change

In `src/pages/field/cm/CMVisitForm.tsx` at line 1280, insert a `ChevronLeft` back button before the existing hamburger menu button inside the top bar `div`.

**Current (line 1280-1287):**
```tsx
<div className="flex items-center h-12 shrink-0 border-b border-slate-700/50 px-3">
  <button
    onClick={() => setTocOpen(true)}
    className="p-2 -ml-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
    aria-label="Table of contents"
  >
    <Menu className="h-5 w-5" />
  </button>
```

**After:**
```tsx
<div className="flex items-center h-12 shrink-0 border-b border-slate-700/50 px-3">
  <button
    onClick={() => navigate(`/field/cm/${projectId}`)}
    className="p-2 -ml-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
    aria-label="Back to project"
  >
    <ChevronLeft className="h-5 w-5" />
  </button>
  <button
    onClick={() => setTocOpen(true)}
    className="p-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
    aria-label="Table of contents"
  >
    <Menu className="h-5 w-5" />
  </button>
```

Note: The `-ml-2` moves from the hamburger button to the new back button so the first icon aligns with the container edge. `ChevronLeft` is already imported (line 5). `navigate` and `projectId` are already available in scope.

### Files Modified
- `src/pages/field/cm/CMVisitForm.tsx` — top bar section only (lines 1281-1287)

