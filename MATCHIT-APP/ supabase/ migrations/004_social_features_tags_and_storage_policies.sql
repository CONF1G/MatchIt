-- Check which tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if photos table has RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'photos';

-- If RLS is on but no SELECT policy exists, add one:
CREATE POLICY "public can view photos"
ON photos FOR SELECT TO public USING (true);

-- Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'comments';

-- Add policies if missing
CREATE POLICY "anyone can view comments" ON comments FOR SELECT TO public USING (true);
CREATE POLICY "authenticated can post comments" ON comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "users can delete own comments" ON comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 1. Table for photo tags
CREATE TABLE IF NOT EXISTS photo_tags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id         uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  tag              text NOT NULL,
  is_ai_generated  boolean NOT NULL DEFAULT false,
  confidence       numeric(5,4),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, tag)
);
ALTER TABLE photo_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read photo_tags"  ON photo_tags FOR SELECT TO public  USING (true);
CREATE POLICY "owner manage photo_tags" ON photo_tags FOR ALL    TO authenticated
  USING  ((SELECT uploader_id FROM photos WHERE id = photo_id) = auth.uid())
  WITH CHECK ((SELECT uploader_id FROM photos WHERE id = photo_id) = auth.uid());

-- 2. Table for photo likes
CREATE TABLE IF NOT EXISTS photo_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id   uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, user_id)
);
ALTER TABLE photo_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read photo_likes"    ON photo_likes FOR SELECT TO public       USING (true);
CREATE POLICY "authenticated manage likes" ON photo_likes FOR ALL    TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Add photo_id column to comments (comments table currently has catalog_id)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS photo_id uuid REFERENCES photos(id) ON DELETE CASCADE;

-- 4. RPC function to toggle a like (returns true = liked, false = unliked)
CREATE OR REPLACE FUNCTION toggle_photo_like(p_photo_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_exists  boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM photo_likes WHERE photo_id = p_photo_id AND user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM photo_likes WHERE photo_id = p_photo_id AND user_id = v_user_id;
    UPDATE photos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_photo_id;
    RETURN false;
  ELSE
    INSERT INTO photo_likes (photo_id, user_id) VALUES (p_photo_id, v_user_id);
    UPDATE photos SET likes_count = likes_count + 1 WHERE id = p_photo_id;
    RETURN true;
  END IF;
END;
$$;

-- 5. Ensure photos are readable by everyone (if not already set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'photos' AND policyname = 'public read photos'
  ) THEN
    EXECUTE 'CREATE POLICY "public read photos" ON photos FOR SELECT TO public USING (true)';
  END IF;
END $$;

SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'comments';

-- Allow authenticated users to insert their own comments
CREATE POLICY "authenticated insert comments"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Allow anyone to read comments
CREATE POLICY "public read comments"
  ON comments FOR SELECT TO public
  USING (true);

-- Allow comment authors to delete their own comments
CREATE POLICY "author delete comments"
  ON comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

--

-- Drop old INSERT policy and replace with one that works
DROP POLICY IF EXISTS "comments_insert" ON comments;

CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

  -- 1. Add the column if it doesn't exist yet
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS photo_id uuid REFERENCES photos(id) ON DELETE CASCADE;

-- 2. Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- ── PHOTOS ────────────────────────────────────────────────────────────────────


-- Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
  VALUES
    ('catalog-photos', 'catalog-photos', true),
    ('thumbnails',     'thumbnails',     true),
    ('avatars',        'avatars',        true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop old storage policies to avoid conflicts
DROP POLICY IF EXISTS "auth_upload_catalog_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_thumbnails"     ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_avatars"        ON storage.objects;
DROP POLICY IF EXISTS "public_read_storage"        ON storage.objects;
DROP POLICY IF EXISTS "owner_delete_storage"       ON storage.objects;

-- Allow authenticated users to upload
CREATE POLICY "auth_upload_catalog_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-photos');

CREATE POLICY "auth_upload_thumbnails" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "auth_upload_avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to update/delete their own files
CREATE POLICY "owner_update_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "owner_delete_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read on all buckets
CREATE POLICY "public_read_storage" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('catalog-photos', 'thumbnails', 'avatars'));
