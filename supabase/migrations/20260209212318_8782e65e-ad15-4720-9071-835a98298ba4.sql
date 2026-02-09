-- Add soft-delete column to uploads
ALTER TABLE public.uploads ADD COLUMN deleted_at timestamptz DEFAULT NULL;