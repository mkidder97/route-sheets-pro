-- Add upload_id to buildings with cascade delete
ALTER TABLE public.buildings ADD COLUMN upload_id uuid REFERENCES public.uploads(id) ON DELETE CASCADE;

-- Add DELETE RLS policy on uploads
CREATE POLICY "Public delete uploads"
ON public.uploads
FOR DELETE
USING (true);