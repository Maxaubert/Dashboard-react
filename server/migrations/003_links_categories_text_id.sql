-- 003_links_categories_text_id.sql
-- Both `categories` and `links` use client-generated TEXT ids in the
-- legacy JSON (links.json v2 envelope). Two anchor categories with
-- reserved ids `__favorites` and `__other` are always present. Switch
-- the primary keys to TEXT so those ids survive verbatim.
--
-- Both tables are empty in production (Phase 4 introduces the first
-- writes for /api/links). Dropping and recreating is safe.

-- ::
DROP TABLE links;

-- ::
DROP TABLE categories;

-- ::
CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE INDEX ON categories (user_id, position);

-- ::
CREATE TABLE links (
  id          TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  url         TEXT NOT NULL,
  name        TEXT NOT NULL,
  sub         TEXT,
  color       TEXT,
  icon_type   TEXT,
  icon_value  TEXT,
  favorite    BOOLEAN NOT NULL DEFAULT FALSE,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE INDEX ON links (user_id, category_id, position);
