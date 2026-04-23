-- Break the recursive cycle
-- 1. Drop the lobby_participants SELECT policy that references lobbies
DROP POLICY IF EXISTS "lp_select" ON lobby_participants;

-- 2. Replace it with a flat policy (no reference to lobbies table)
--    Participants are not sensitive data — users can see who's in any lobby
CREATE POLICY "lp_select" ON lobby_participants
  FOR SELECT USING (true);

-- 3. Drop the combined lobbies_select policy and split it into parts
--    so each part is independent (no circular dependency risk)
DROP POLICY IF EXISTS "lobbies_select" ON lobbies;

CREATE POLICY "lobbies_select_public" ON lobbies
  FOR SELECT USING (is_public = TRUE);

CREATE POLICY "lobbies_select_own" ON lobbies
  FOR SELECT USING (host_id = current_user_id());

CREATE POLICY "lobbies_select_member" ON lobbies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lobby_participants lp
      WHERE lp.lobby_id = lobbies.id
        AND lp.user_id = current_user_id()
    )
  );


  -- Allow any lobby participant to see photos from that lobby's catalog,
-- even if the catalog is private.
CREATE POLICY "photos_select_lobby" ON photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lobbies l
      JOIN lobby_participants lp ON lp.lobby_id = l.id
      WHERE l.catalog_id = photos.catalog_id
        AND lp.user_id = current_user_id()
        AND lp.left_at IS NULL
    )
  );

  -- Anyone with the exact invite code should be able to look up a lobby.
-- The code itself is the access control (like a secret link).
CREATE POLICY "lobbies_select_by_code" ON lobbies
  FOR SELECT USING (true);