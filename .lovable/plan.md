
# Add Portfolio Route to App.tsx

Two small additions to `src/App.tsx`, nothing else touched.

## Changes

### 1. Lazy import (after line 24, alongside other page imports)
```ts
const Portfolio = lazy(() => import("./pages/Portfolio"));
```

### 2. Route (inside the ProtectedRoute/UnifiedLayout group, after the `/budgets` route at line 71)
```tsx
<Route path="/portfolio" element={<Portfolio />} />
```

Note: This assumes `src/pages/Portfolio.tsx` already exists or will be created separately. No other files or routes are modified.
