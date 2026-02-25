

# Add Regions Fetch to Dashboard

## Summary

Add a 5th parallel fetch for `regions` data to compute the "Across N regions" subtext on the Active Clients KPI card.

## Change: `src/pages/Dashboard.tsx`

### Data Fetching

Add to the existing `Promise.all`:

```typescript
supabase.from('regions').select('id, client_id')
```

This becomes the 5th query alongside buildings, clients, inspection_campaigns, and cm_jobs.

### Computation

From the regions result, count distinct `region_id` values (just `regions.length` since each row is a unique region). Use this as the "Across N regions" subtext on the Active Clients card.

### No other changes

Everything else in the approved dashboard plan remains identical. This just adds one more query to the parallel fetch and wires the count into the existing KPI card subtext.

