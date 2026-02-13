INSERT INTO storage.buckets (id, name, public) VALUES ('cad-drawings', 'cad-drawings', true);

CREATE POLICY "Public upload cad drawings" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cad-drawings');
CREATE POLICY "Public read cad drawings" ON storage.objects FOR SELECT USING (bucket_id = 'cad-drawings');