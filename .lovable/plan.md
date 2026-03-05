

## Database Migration: CM Photo Labeling Support

Two column additions across two existing tables.

### Changes

1. **cm_photos** — Add `label` column (text, nullable) for photo category
2. **cm_visits** — Add `custom_photo_labels` column (text[], nullable, default `'{}'`) for persisting inspector-created labels per visit

### SQL

```sql
ALTER TABLE public.cm_photos ADD COLUMN label text;
ALTER TABLE public.cm_visits ADD COLUMN custom_photo_labels text[] DEFAULT '{}';
```

No RLS changes needed (both tables already have authenticated-all policies). No UI changes.

