-- Allow authenticated users to upload photos and thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('catalog-photos', 'catalog-photos', true),
  ('thumbnails', 'thumbnails', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload
CREATE POLICY "auth upload catalog-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catalog-photos');

CREATE POLICY "auth upload thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "auth upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow public read
CREATE POLICY "public read catalog-photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'catalog-photos');

CREATE POLICY "public read thumbnails"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'thumbnails');

CREATE POLICY "public read avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Allow owners to delete their own files
CREATE POLICY "auth delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (owner_id = auth.uid()::text);
