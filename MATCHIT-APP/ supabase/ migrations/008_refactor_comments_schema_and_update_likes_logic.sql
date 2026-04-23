-- 1. Curățăm politicile vechi care foloseau catalog_id
DROP POLICY IF EXISTS "comments_select" ON comments;

-- 2. Ștergem coloana buclucașă
ALTER TABLE comments DROP COLUMN catalog_id;

-- 3. Punem la loc o politică de vizibilitate curată
CREATE POLICY "comments_select_new" ON comments
  FOR SELECT TO public
  USING (true);CREATE OR REPLACE FUNCTION toggle_photo_like(p_photo_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists  BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM photo_likes
    WHERE photo_id = p_photo_id AND user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM photo_likes WHERE photo_id = p_photo_id AND user_id = v_user_id;
    RETURN FALSE;  -- now unliked
  ELSE
    INSERT INTO photo_likes (photo_id, user_id) VALUES (p_photo_id, v_user_id);
    RETURN TRUE;   -- now liked
  END IF;
  -- The trg_photo_likes_count trigger handles likes_count automatically
END;
$$;

ALTER TABLE comments ALTER COLUMN catalog_id DROP NOT NULL;

DROP POLICY IF EXISTS "comments_select" ON comments;
-- Verifică dacă mai ai și altele, de exemplu:
DROP POLICY IF EXISTS "anyone can view comments" ON comments;

ALTER TABLE comments DROP COLUMN catalog_id;

CREATE POLICY "comments_select" ON comments
  FOR SELECT TO public
  USING (true); 
  -- Sau o logică mai complexă care verifică dacă poza există:
  -- USING (EXISTS (SELECT 1 FROM photos WHERE id = photo_id));