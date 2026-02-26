

# Portfolio Analytics Page

## Summary
Create a new read-only Portfolio Analytics page at `/analytics` with interactive sqft-scale toggling and 5 tabbed breakdowns (Maintenance, Capital & Replacement, Leak & Risk, Condition, Warranty). Also wire it into routing and navigation.

## Files Changed

### 1. New file: `src/pages/Analytics.tsx`
A single large page component containing:

- **Shared helpers**: `fmtMoney`, `fmtArea`, `scaleMetric`, `AnalyticsKpiCard` (reusable card matching the design system KPI pattern)
- **Data loading**: `Promise.all` fetching buildings (non-deleted), roof_sections, and clients from the database
- **Sqft Scale Selector**: Horizontal pill toggle at page top (Per Building / Per 50K / Per 100K / Per 250K / Per 1M sqft) controlling all per-sqft metrics
- **5 Tabs** using shadcn `Tabs` component:
  - **Maintenance**: KPI cards for estimated/actual maint cost (scaled), data coverage %, variance. Breakdown table by client.
  - **Capital & Replacement**: Cap ex (scaled), avg remaining life, replacements due (5yr), projected 5yr spend. Breakdown tables by replacement timeline and by expense type.
  - **Leak & Risk**: Leak expense (scaled), leak frequency, overdue inspections, priority buildings. Breakdown by state.
  - **Condition**: Avg roof rating, poor condition count, avg LTTR, sections with data. Breakdowns by roof system (with inline rating bars) and rating distribution buckets.
  - **Warranty**: Mfg coverage %, contractor coverage %, expiring (12mo), already expired. Breakdown by expiration timeline windows.
- **Loading state**: 8 skeleton cards + skeleton tabs
- **Error state**: Centered retry message

All derived metrics follow the user's exact formulas. The scale selector applies to all per-sqft KPI cards across all tabs. Flat metrics (avg rating, remaining life, counts) are unaffected by scale.

### 2. `src/App.tsx`
- Add lazy import: `const Analytics = lazy(() => import("./pages/Analytics"));`
- Add route inside the protected layout block: `<Route path="/analytics" element={<Analytics />} />`

### 3. `src/components/UnifiedLayout.tsx`
- Import `BarChart3` from lucide-react
- **Desktop nav**: Add "Analytics" as a plain `Link` (same pattern as Dashboard) after the Dashboard link, before the dropdown sections
- **Mobile drawer**: Add an "Analytics" button with `BarChart3` icon after Dashboard and before the Portfolio section

No database migrations needed. No mutations. Read-only page using existing columns.

## Technical Details

### Data Queries
Three parallel queries via `Promise.all`:
1. `buildings` -- selecting id, client_id, square_footage, inspection_status, is_priority, install_year, state, total_leaks_12mo, total_leak_expense_12mo, requires_escort, installer_has_warranty, manufacturer_has_warranty, preventative_budget_estimated, preventative_budget_actual, next_inspection_due (filtered non-deleted)
2. `roof_sections` -- selecting id, building_id, section_name, roof_system, rating, lttr_value, capital_expense_amount, capital_expense_per_sqft, capital_expense_type, capital_expense_year, replacement_year, year_installed, has_manufacturer_warranty, warranty_expiration_date, has_contractor_warranty, contractor_warranty_expiration, has_recover
3. `clients` -- id, name, is_active

### Scale Metric Logic
```text
per_building mode: totalCost / buildingCount
per_sqft mode:     (totalCost / totalSqft) * scaleValue
```

### Component Structure
```text
Analytics (default export)
  +-- AnalyticsKpiCard (local component, reused ~20 times)
  +-- fmtMoney, fmtArea, scaleMetric (local helpers)
  +-- Tabs > TabsContent x5
       +-- KPI card grids (grid-cols-2 md:grid-cols-4)
       +-- Breakdown tables (shadcn Table)
```

### Navigation Placement
- Desktop: Dashboard | Analytics | [Portfolio v] | [Inspections v] | ...
- Mobile drawer: Dashboard, Analytics (with BarChart3 icon), then section groups

