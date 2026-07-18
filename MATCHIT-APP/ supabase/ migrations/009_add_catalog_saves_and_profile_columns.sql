-- =============================================================================
-- Migration 009: Add catalog_saves table and profile columns
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalog_saves (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  catalog_id  UUID NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, catalog_id)
);

ALTER TABLE catalog_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saves_select_own" ON catalog_saves FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "saves_insert_own" ON catalog_saves FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "saves_delete_own" ON catalog_saves FOR DELETE
  USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_catalog_saves_user    ON catalog_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_saves_catalog ON catalog_saves(catalog_id);

-- =============================================================================
-- Profile columns
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS interests            text[]  NOT NULL DEFAULT '{}';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
