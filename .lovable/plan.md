

# Add Codes Tab to the Buildings Page

## Problem

The Codes feature (lockbox code lookup) is currently only accessible at `/admin/data` under the Data Import page. It's not visible from the main `/buildings` route that the user navigates to regularly. This was a tool the user actively used, and it needs to be front-and-center on the Buildings page.

## Solution

Add a tabbed layout to the Buildings page with two tabs: **Buildings** (the current table) and **Codes** (the existing `CodesContent` component). This mirrors the pattern already used in `DataManager.tsx`.

## Changes

### `src/pages/Buildings.tsx`

Modify the default export to wrap `BuildingsContent` and `CodesContent` in a `Tabs` component:

- Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from shadcn
- Import `CodesContent` from `./Codes`
- Replace the current simple layout with a tabbed layout:
  - Tab 1: "Buildings" (default) renders `BuildingsContent`
  - Tab 2: "Codes" renders `CodesContent`

The page header stays as-is ("Buildings" title), and the tabs appear below it.

No other files need to change. The existing `/admin/data` DataManager page continues to work independently.
