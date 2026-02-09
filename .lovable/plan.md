

# Undo Upload Feature

## Where It Lives
The **Dashboard page**, in the "Recent Uploads" card. Each upload entry gets a trash icon button that triggers a confirmation dialog, then cascading-deletes all data from that import.

## How It Works

1. **Trash button** appears on each upload row in the Recent Uploads list
2. Clicking it opens a **confirmation dialog** showing the file name and row count ("Delete 157 buildings from LinkLogistics_DFW.xlsx?")
3. On confirm, the system deletes in this order:
   - Remove any `route_plan_buildings` referencing those buildings
   - Remove any now-empty `route_plan_days` and `route_plans`
   - Delete all `buildings` that belong to that upload
   - Delete the `uploads` record itself
   - Orphaned inspectors/regions/clients are left in place (they may be referenced by other uploads)
4. Dashboard stats and lists refresh automatically after deletion

## Database Change

The `uploads` table currently has no way to trace which buildings came from which upload. We need to add:

```
ALTER TABLE buildings ADD COLUMN upload_id uuid REFERENCES uploads(id) ON DELETE CASCADE;
```

The `ON DELETE CASCADE` means deleting an upload record automatically removes its buildings. We also need to update the import logic in `Upload.tsx` to set `upload_id` on each inserted building.

A DELETE RLS policy is also needed on the `uploads` table (currently missing).

## Files Changed

- **Migration**: Add `upload_id` column to `buildings`, add DELETE policy on `uploads`
- **`src/pages/Upload.tsx`**: Set `upload_id` on buildings during import (insert the upload record first, then use its ID)
- **`src/pages/Dashboard.tsx`**: Add trash button per upload row, confirmation dialog, and delete handler that removes the upload (cascade handles buildings), plus cleans up related route plan data

## Deletion Logic Detail

Since `ON DELETE CASCADE` handles buildings automatically when the upload is deleted, the delete handler only needs to:
1. Find building IDs for that upload
2. Delete any `route_plan_buildings` rows referencing those building IDs
3. Clean up empty `route_plan_days` and `route_plans`
4. Delete the `uploads` row (cascade removes buildings)
5. Refresh the dashboard data

