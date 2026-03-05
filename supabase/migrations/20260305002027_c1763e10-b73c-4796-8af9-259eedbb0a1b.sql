ALTER TABLE public.cm_photos ADD COLUMN label text;
ALTER TABLE public.cm_visits ADD COLUMN custom_photo_labels text[] DEFAULT '{}';