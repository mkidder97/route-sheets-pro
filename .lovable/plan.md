

# Lazy Load All Routes in App.tsx

## Overview
Convert all 11 page component imports to `React.lazy()` and wrap the route tree in `<Suspense>` with a spinner fallback. No route paths, layouts, or protection logic change.

## Changes (single file: `src/App.tsx`)

### 1. Update React import
Add `lazy` and `Suspense` to the React import:
```ts
import { lazy, Suspense } from "react";
```

### 2. Replace all 11 page imports with lazy equivalents
Convert these static imports:
```ts
import MyRoutes from "./pages/MyRoutes";
import RouteBuilder from "./pages/RouteBuilder";
// ... etc
```
To:
```ts
const MyRoutes = lazy(() => import("./pages/MyRoutes"));
const RouteBuilder = lazy(() => import("./pages/RouteBuilder"));
const DataManager = lazy(() => import("./pages/DataManager"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const OpsDashboard = lazy(() => import("./pages/ops/OpsDashboard"));
const OpsJobBoard = lazy(() => import("./pages/ops/OpsJobBoard"));
const OpsCampaignDetail = lazy(() => import("./pages/ops/OpsCampaignDetail"));
const OpsScheduling = lazy(() => import("./pages/ops/OpsScheduling"));
const OpsTimeMileage = lazy(() => import("./pages/ops/OpsTimeMileage"));
const OpsSettings = lazy(() => import("./pages/ops/OpsSettings"));
```

### 3. Wrap `<Routes>` in `<Suspense>`
```tsx
<Suspense fallback={
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
}>
  <Routes>
    {/* all existing routes unchanged */}
  </Routes>
</Suspense>
```

### What stays the same
- All route paths, nesting, and `element` props
- `ProtectedRoute`, `AppLayout`, `OpsLayout` remain static imports (they are layout/wrapper components, not pages)
- All other imports (react-router-dom, tanstack, etc.) unchanged

