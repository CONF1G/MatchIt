-- =============================================================================
-- MATCHIT — Migration 003: Functions, Triggers & Realtime
-- =============================================================================
-- Run order: 3rd (after 002_add_rls_policies.sql)
-- Description: Automation triggers, counter denormalization, match detection,
--              and Realtime publication setup.
-- =============================================================================

-- =============================================================================
-- 1. AUTO-CREATE PROFILE ON SIGNUP
-- Fires after a new user is inserted into auth.users
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  -- Derive username from email (part before @), strip non-alphanumeric
  base_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'));

  -- Guarantee uniqueness by appending a counter if needed
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- 2. AUTO-UPDATE updated_at TIMESTAMP
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_catalogs_updated_at
  BEFORE UPDATE ON catalogs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_photos_updated_at
  BEFORE UPDATE ON photos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_lobbies_updated_at
  BEFORE UPDATE ON lobbies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 3. DENORMALIZED COUNTERS — Follows
-- =============================================================================

CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_follows_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- =============================================================================
-- 4. DENORMALIZED COUNTERS — Catalog likes
-- =============================================================================

CREATE OR REPLACE FUNCTION update_catalog_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE catalogs SET likes_count = likes_count + 1 WHERE id = NEW.catalog_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE catalogs SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.catalog_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_catalog_likes_count
  AFTER INSERT OR DELETE ON catalog_likes
  FOR EACH ROW EXECUTE FUNCTION update_catalog_like_count();

-- =============================================================================
-- 5. DENORMALIZED COUNTERS — Photo likes
-- =============================================================================

CREATE OR REPLACE FUNCTION update_photo_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE photos SET likes_count = likes_count + 1 WHERE id = NEW.photo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE photos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.photo_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_photo_likes_count
  AFTER INSERT OR DELETE ON photo_likes
  FOR EACH ROW EXECUTE FUNCTION update_photo_like_count();

-- =============================================================================
-- 6. DENORMALIZED COUNTERS — Photos per catalog
-- =============================================================================

CREATE OR REPLACE FUNCTION update_catalog_photos_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE catalogs SET photos_count = photos_count + 1 WHERE id = NEW.catalog_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE catalogs SET photos_count = GREATEST(photos_count - 1, 0) WHERE id = OLD.catalog_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_photos_count
  AFTER INSERT OR DELETE ON photos
  FOR EACH ROW EXECUTE FUNCTION update_catalog_photos_count();

-- =============================================================================
-- 7. DENORMALIZED COUNTERS — Catalogs per profile
-- =============================================================================

CREATE OR REPLACE FUNCTION update_profile_catalogs_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET catalogs_count = catalogs_count + 1 WHERE id = NEW.owner_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET catalogs_count = GREATEST(catalogs_count - 1, 0) WHERE id = OLD.owner_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_catalogs_count
  AFTER INSERT OR DELETE ON catalogs
  FOR EACH ROW EXECUTE FUNCTION update_profile_catalogs_count();

-- =============================================================================
-- 8. MATCH DETECTION
-- After each swipe, check if 2+ participants liked the same photo in a lobby.
-- If yes, insert/update a match record.
-- =============================================================================

CREATE OR REPLACE FUNCTION detect_match_after_swipe()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lobby_id    UUID;
  v_like_count  INT;
  v_liked_by    UUID[];
BEGIN
  -- Only fire on 'like' or 'super_like' swipes
  IF NEW.action NOT IN ('like', 'super_like') THEN
    RETURN NEW;
  END IF;

  -- Resolve lobby_id from the session
  SELECT lp.lobby_id INTO v_lobby_id
  FROM swipe_sessions ss
  JOIN lobby_participants lp ON lp.id = ss.participant_id
  WHERE ss.id = NEW.session_id;

  -- Count how many participants in this lobby liked the same photo
  SELECT
    COUNT(*),
    ARRAY_AGG(lp.user_id)
  INTO v_like_count, v_liked_by
  FROM swipes s
  JOIN swipe_sessions ss ON ss.id = s.session_id
  JOIN lobby_participants lp ON lp.id = ss.participant_id
  WHERE s.photo_id = NEW.photo_id
    AND lp.lobby_id = v_lobby_id
    AND s.action IN ('like', 'super_like');

  -- Match threshold: at least 2 players liked it
  IF v_like_count >= 2 THEN
    INSERT INTO matches (lobby_id, photo_id, matched_by)
    VALUES (v_lobby_id, NEW.photo_id, v_liked_by)
    ON CONFLICT DO NOTHING;  -- idempotent if match already recorded
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_match
  AFTER INSERT ON swipes
  FOR EACH ROW EXECUTE FUNCTION detect_match_after_swipe();

-- =============================================================================
-- 9. NOTIFY ON MATCH — insert notification for all matched participants
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID;
BEGIN
  FOREACH v_user IN ARRAY NEW.matched_by LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_user,
      'match_result',
      'It''s a Match! 🎉',
      'You and others matched on a photo.',
      jsonb_build_object('lobby_id', NEW.lobby_id, 'photo_id', NEW.photo_id, 'match_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_match
  AFTER INSERT ON matches
  FOR EACH ROW EXECUTE FUNCTION notify_on_match();

-- =============================================================================
-- 10. GUEST PROFILE CREATION (callable from app)
-- Creates a temporary guest profile with a random code.
-- Returns the new profile row.
-- =============================================================================

CREATE OR REPLACE FUNCTION create_guest_profile(p_display_name TEXT)
RETURNS profiles LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code     TEXT;
  v_username TEXT;
  v_profile  profiles;
BEGIN
  -- Generate a unique guest code
  LOOP
    v_code := 'GUEST-' || upper(substring(gen_random_uuid()::text, 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE guest_code = v_code);
  END LOOP;

  v_username := lower(replace(v_code, '-', '_'));

  -- Guest profiles don't reference auth.users, so we use a random UUID
  INSERT INTO profiles (id, username, display_name, is_guest, guest_code)
  VALUES (uuid_generate_v4(), v_username, p_display_name, TRUE, v_code)
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

-- =============================================================================
-- 11. JOIN LOBBY BY INVITE CODE (callable from app)
-- Validates code, checks capacity, inserts participant row.
-- =============================================================================

CREATE OR REPLACE FUNCTION join_lobby_by_code(
  p_invite_code TEXT,
  p_user_id     UUID DEFAULT auth.uid()
)
RETURNS lobby_participants LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lobby      lobbies;
  v_count      INT;
  v_participant lobby_participants;
BEGIN
  -- Find lobby
  SELECT * INTO v_lobby FROM lobbies WHERE invite_code = upper(p_invite_code);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby not found for code %', p_invite_code;
  END IF;

  IF v_lobby.status <> 'waiting' THEN
    RAISE EXCEPTION 'Lobby % is already %', v_lobby.id, v_lobby.status;
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_count
  FROM lobby_participants
  WHERE lobby_id = v_lobby.id AND left_at IS NULL;

  IF v_count >= v_lobby.max_players THEN
    RAISE EXCEPTION 'Lobby is full (% / %)', v_count, v_lobby.max_players;
  END IF;

  -- Upsert participant
  INSERT INTO lobby_participants (lobby_id, user_id, role)
  VALUES (v_lobby.id, p_user_id, 'player')
  ON CONFLICT (lobby_id, user_id) DO UPDATE SET left_at = NULL
  RETURNING * INTO v_participant;

  RETURN v_participant;
END;
$$;

-- =============================================================================
-- 12. REALTIME PUBLICATIONS
-- Enable Postgres realtime for tables that need live updates in the app.
-- =============================================================================

-- Drop existing publication if present (idempotent re-run)
DROP PUBLICATION IF EXISTS supabase_realtime;

CREATE PUBLICATION supabase_realtime FOR TABLE
  lobby_participants,   -- player joins/leaves lobby
  lobbies,              -- lobby status changes (started, finished)
  swipes,               -- live swipe events
  matches,              -- match detected events
  notifications;        -- push notification delivery via realtime

-- =============================================================================
-- 13. STORAGE BUCKETS (run via Supabase dashboard OR CLI)
-- These are SQL-equivalent hints — actual bucket creation is via Supabase API.
-- Included here as documentation.
-- =============================================================================

-- Bucket: avatars     → public, 2MB max, image/* only
-- Bucket: catalog-photos → public, 10MB max, image/* only
-- Bucket: thumbnails  → public, 1MB max, image/* only

-- RLS on storage.objects is managed via Supabase Storage policies (dashboard).
-- Policy template (avatars bucket):
--   SELECT: bucket_id = 'avatars'
--   INSERT: bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
--   DELETE: bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
