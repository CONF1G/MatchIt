v-- =============================================================================
-- MATCHIT — Migration 002: Row Level Security Policies
-- =============================================================================
-- Run order: 2nd (after 001_initial_schema.sql)
-- Description: Enables RLS and defines access policies for all tables.
-- =============================================================================

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows              ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_likes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_likes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipe_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTION
-- Returns the current authenticated user's profile id (same as auth.uid())
-- =============================================================================

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT auth.uid()
$$;

-- =============================================================================
-- PROFILES
-- =============================================================================

-- Anyone can view public profiles
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  USING (TRUE);

-- Only the owner can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = current_user_id())
  WITH CHECK (id = current_user_id());

-- Profile is created automatically via trigger (see migration 003)
-- No direct INSERT policy needed for authenticated users

-- =============================================================================
-- FOLLOWS
-- =============================================================================

CREATE POLICY "follows_select_all"
  ON follows FOR SELECT
  USING (TRUE);

CREATE POLICY "follows_insert_own"
  ON follows FOR INSERT
  WITH CHECK (follower_id = current_user_id());

CREATE POLICY "follows_delete_own"
  ON follows FOR DELETE
  USING (follower_id = current_user_id());

-- =============================================================================
-- CATALOGS
-- =============================================================================

-- Public catalogs are visible to everyone; private ones only to owner
CREATE POLICY "catalogs_select"
  ON catalogs FOR SELECT
  USING (
    is_private = FALSE
    OR owner_id = current_user_id()
  );

CREATE POLICY "catalogs_insert_own"
  ON catalogs FOR INSERT
  WITH CHECK (owner_id = current_user_id());

CREATE POLICY "catalogs_update_own"
  ON catalogs FOR UPDATE
  USING (owner_id = current_user_id())
  WITH CHECK (owner_id = current_user_id());

CREATE POLICY "catalogs_delete_own"
  ON catalogs FOR DELETE
  USING (owner_id = current_user_id());

-- =============================================================================
-- PHOTOS
-- =============================================================================

-- Photo is visible if its parent catalog is visible
CREATE POLICY "photos_select"
  ON photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM catalogs c
      WHERE c.id = photos.catalog_id
        AND (c.is_private = FALSE OR c.owner_id = current_user_id())
    )
  );

CREATE POLICY "photos_insert_own"
  ON photos FOR INSERT
  WITH CHECK (uploader_id = current_user_id());

CREATE POLICY "photos_update_own"
  ON photos FOR UPDATE
  USING (uploader_id = current_user_id())
  WITH CHECK (uploader_id = current_user_id());

CREATE POLICY "photos_delete_own"
  ON photos FOR DELETE
  USING (uploader_id = current_user_id());

-- =============================================================================
-- CATALOG LIKES
-- =============================================================================

CREATE POLICY "catalog_likes_select"
  ON catalog_likes FOR SELECT
  USING (TRUE);

CREATE POLICY "catalog_likes_insert"
  ON catalog_likes FOR INSERT
  WITH CHECK (user_id = current_user_id());

CREATE POLICY "catalog_likes_delete"
  ON catalog_likes FOR DELETE
  USING (user_id = current_user_id());

-- =============================================================================
-- PHOTO LIKES
-- =============================================================================

CREATE POLICY "photo_likes_select"
  ON photo_likes FOR SELECT
  USING (TRUE);

CREATE POLICY "photo_likes_insert"
  ON photo_likes FOR INSERT
  WITH CHECK (user_id = current_user_id());

CREATE POLICY "photo_likes_delete"
  ON photo_likes FOR DELETE
  USING (user_id = current_user_id());

-- =============================================================================
-- COMMENTS
-- =============================================================================

CREATE POLICY "comments_select"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM catalogs c
      WHERE c.id = comments.catalog_id
        AND (c.is_private = FALSE OR c.owner_id = current_user_id())
    )
  );

CREATE POLICY "comments_insert"
  ON comments FOR INSERT
  WITH CHECK (author_id = current_user_id());

CREATE POLICY "comments_update_own"
  ON comments FOR UPDATE
  USING (author_id = current_user_id())
  WITH CHECK (author_id = current_user_id());

CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE
  USING (author_id = current_user_id());

-- =============================================================================
-- LOBBIES
-- =============================================================================

-- Public lobbies or lobbies where user is a participant
CREATE POLICY "lobbies_select"
  ON lobbies FOR SELECT
  USING (
    is_public = TRUE
    OR host_id = current_user_id()
    OR EXISTS (
      SELECT 1 FROM lobby_participants lp
      WHERE lp.lobby_id = lobbies.id
        AND lp.user_id = current_user_id()
    )
  );

CREATE POLICY "lobbies_insert_own"
  ON lobbies FOR INSERT
  WITH CHECK (host_id = current_user_id());

-- Only host can update the lobby
CREATE POLICY "lobbies_update_host"
  ON lobbies FOR UPDATE
  USING (host_id = current_user_id())
  WITH CHECK (host_id = current_user_id());

CREATE POLICY "lobbies_delete_host"
  ON lobbies FOR DELETE
  USING (host_id = current_user_id());

-- =============================================================================
-- LOBBY PARTICIPANTS
-- =============================================================================

CREATE POLICY "lp_select"
  ON lobby_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lobbies l
      WHERE l.id = lobby_participants.lobby_id
        AND (
          l.is_public = TRUE
          OR l.host_id = current_user_id()
          OR lobby_participants.user_id = current_user_id()
        )
    )
  );

CREATE POLICY "lp_insert_own"
  ON lobby_participants FOR INSERT
  WITH CHECK (user_id = current_user_id());

CREATE POLICY "lp_update_own"
  ON lobby_participants FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

CREATE POLICY "lp_delete_own"
  ON lobby_participants FOR DELETE
  USING (user_id = current_user_id());

-- =============================================================================
-- SWIPE SESSIONS
-- =============================================================================

CREATE POLICY "swipe_sessions_select"
  ON swipe_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lobby_participants lp
      WHERE lp.id = swipe_sessions.participant_id
        AND lp.user_id = current_user_id()
    )
  );

CREATE POLICY "swipe_sessions_insert"
  ON swipe_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lobby_participants lp
      WHERE lp.id = swipe_sessions.participant_id
        AND lp.user_id = current_user_id()
    )
  );

CREATE POLICY "swipe_sessions_update"
  ON swipe_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lobby_participants lp
      WHERE lp.id = swipe_sessions.participant_id
        AND lp.user_id = current_user_id()
    )
  );

-- =============================================================================
-- SWIPES
-- =============================================================================

CREATE POLICY "swipes_select_own"
  ON swipes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM swipe_sessions ss
      JOIN lobby_participants lp ON lp.id = ss.participant_id
      WHERE ss.id = swipes.session_id
        AND lp.user_id = current_user_id()
    )
  );

CREATE POLICY "swipes_insert_own"
  ON swipes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM swipe_sessions ss
      JOIN lobby_participants lp ON lp.id = ss.participant_id
      WHERE ss.id = swipes.session_id
        AND lp.user_id = current_user_id()
    )
  );

-- =============================================================================
-- MATCHES
-- Visible to all participants in the lobby
-- =============================================================================

CREATE POLICY "matches_select"
  ON matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lobby_participants lp
      WHERE lp.lobby_id = matches.lobby_id
        AND lp.user_id = current_user_id()
    )
  );

-- Matches are inserted only via DB functions (see migration 003)
-- No direct INSERT policy for end users

-- =============================================================================
-- NOTIFICATIONS
-- Users can only see and manage their own notifications
-- =============================================================================

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (user_id = current_user_id());

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING (user_id = current_user_id());
