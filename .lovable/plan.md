

## Fix History Tab QueryFn

### Single file: `src/pages/field/FieldInspections.tsx`

Replace the History queryFn's last section (the `campaign_buildings` fetch with `.eq("inspection_status", "complete")` and the map) with the corrected 3-step approach:

1. Fetch all `campaign_buildings` for the campaign IDs (no status filter), select `building_id, campaign_id`
2. Fetch from `buildings` where `id` in those building IDs AND `inspection_status = 'complete'`, ordered by `completion_date` desc, limit 100
3. Map results back using `campaignMap` lookup via the `campBuildings` join

No other changes to imports, state, or rendering.

