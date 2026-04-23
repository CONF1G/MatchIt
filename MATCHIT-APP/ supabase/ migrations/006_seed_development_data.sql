-- =============================================================================
-- MATCHIT — Seed Data (Development Only)
-- =============================================================================
-- WARNING: Run this ONLY against a local or staging database.
-- Creates sample profiles, catalogs, photos and a lobby for UI testing.
-- =============================================================================

-- Disable RLS temporarily for seeding
SET session_replication_role = 'replica';

-- =============================================================================
-- SEED PROFILES
-- UUIDs are fixed so foreign keys stay consistent across re-seeds.
-- These users must already exist in auth.users (create them via Supabase CLI
-- or dashboard before running this seed).
-- =============================================================================
-- 1. Ensure the pgcrypto extension exists for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Insert into Supabase Auth table first
-- We use valid hex IDs and fill out the required system columns
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  created_at, 
  updated_at, 
  role, 
  aud, 
  confirmation_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001', 
    'alex@example.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{}', 
    now(), 
    now(), 
    'authenticated', 
    'authenticated', 
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000002', 
    'maria@example.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{}', 
    now(), 
    now(), 
    'authenticated', 
    'authenticated', 
    ''
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Now insert into your Profiles table
-- The IDs here n
-- Insert into Supabase Auth table first
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'alex@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', ''),
  ('00000000-0000-0000-0000-000000000002', 'maria@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', '')
ON CONFLICT (id) DO NOTHING;

-- Now your existing profiles insert will work!

-- SEED PROFILES
INSERT INTO profiles (id, username, display_name, avatar_url, bio, followers_count, following_count, catalogs_count)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'alex_dev',    'Alex Dev',    'https://i.pravatar.cc/150?u=1', 'Building MATCHIT 🚀', 120, 85, 3),
  ('00000000-0000-0000-0000-000000000002', 'maria_ux',    'Maria UX',    'https://i.pravatar.cc/150?u=2', 'Design & coffee ☕',   340, 210, 2),
  ('00000000-0000-0000-0000-000000000003', 'john_test',   'John Test',   'https://i.pravatar.cc/150?u=3', 'QA Engineer',          55, 40, 1),
  ('00000000-0000-0000-0000-000000000004', 'guest_alpha',  'Alpha Guest', NULL,                           NULL,                    0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SEED CATALOGS
-- =============================================================================

-- SEED CATALOGS (Changed 'c' to 'a' or '1')
INSERT INTO catalogs (id, owner_id, title, description, cover_url, is_private, tags, photos_count, likes_count)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Urban Architecture',
    'My favorite brutalist and modern buildings from around Europe.',
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400',
    FALSE,
    ARRAY['architecture', 'urban', 'europe'],
    4, 12
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Street Food Vibes',
    'The best street food photos from my travels.',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
    FALSE,
    ARRAY['food', 'travel', 'street'],
    3, 27
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Private WIP',
    'Work in progress, not ready to share.',
    NULL,
    TRUE,
    ARRAY['draft'],
    0, 0
  )
ON CONFLICT (id) DO NOTHING;

-- SEED PHOTOS (Changed 'p' to 'f')
INSERT INTO photos (id, catalog_id, uploader_id, storage_path, url, thumbnail_url, title, sort_order)
VALUES
  (
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'catalog-photos/seed/arch1.jpg',
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800',
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=300',
    'Brutalist Block',
    0
  ),
  (
    'f0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'catalog-photos/seed/arch2.jpg',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300',
    'Glass Tower',
    1
  )
ON CONFLICT (id) DO NOTHING;

-- SEED LOBBY (Changed 'l' to 'b')
INSERT INTO lobbies (id, host_id, catalog_id, title, mode, status, invite_code, max_players, is_public)
VALUES
  (
    'b0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Architecture Showdown',
    'first_match',
    'waiting',
    'SEED01',
    6,
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO lobby_participants (lobby_id, user_id, role)
VALUES
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'host'),
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'player')
ON CONFLICT DO NOTHING;

-- Re-enable RLS
SET session_replication_role = 'origin';

-- Refresh denormalized counters after bulk insert
UPDATE profiles SET
  followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = profiles.id),
  following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = profiles.id),
  catalogs_count  = (SELECT COUNT(*) FROM catalogs WHERE owner_id = profiles.id);

UPDATE catalogs SET
  photos_count = (SELECT COUNT(*) FROM photos WHERE catalog_id = catalogs.id);
