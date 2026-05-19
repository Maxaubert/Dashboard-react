-- 001_initial.sql
-- Full multi-user schema. See plans_md/2026-05-19-multi-user-backend-design.md.

-- ::
CREATE EXTENSION IF NOT EXISTS citext;

-- ::
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE TABLE invite_codes (
  code            TEXT PRIMARY KEY,
  created_by_id   BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by_id      BIGINT REFERENCES users(id),
  used_at         TIMESTAMPTZ
);

-- ::
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent  TEXT
);
CREATE INDEX ON sessions (user_id);
CREATE INDEX ON sessions (expires_at);

-- ::
CREATE TABLE user_integrations (
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  payload_enc      BYTEA NOT NULL,
  iv               BYTEA NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, integration_type)
);

-- ::
CREATE TABLE todos (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  priority     TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  deadline     DATE,
  done         BOOLEAN NOT NULL DEFAULT FALSE,
  pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON todos (user_id, done, position);

-- ::
CREATE TABLE plan_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  tag         TEXT,
  location    TEXT,
  color       TEXT,
  recurring   BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX ON plan_events (user_id, date);

-- ::
CREATE TABLE notes (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON notes (user_id, updated_at DESC);

-- ::
CREATE TABLE categories (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON categories (user_id, position);

-- ::
CREATE TABLE links (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
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
CREATE INDEX ON links (user_id, category_id, position);

-- ::
CREATE TABLE home_layout (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE TABLE cache_skole (
  user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE TABLE cache_wishlist (
  user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE TABLE reports (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('bug','feature')),
  title       TEXT NOT NULL,
  body        TEXT,
  page        TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
