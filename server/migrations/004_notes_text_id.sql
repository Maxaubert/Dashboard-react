-- 004_notes_text_id.sql
-- Frontend uses client-generated TEXT ids for notes (e.g.
-- `note_<timestamp>`). Schema currently has notes.id as BIGSERIAL;
-- switch to TEXT so legacy ids survive verbatim if we ever migrate
-- old data. notes table is currently empty in production (the Flask
-- sidecar was orphaned by an earlier nginx rewrite), so dropping
-- and recreating is safe.

-- ::
DROP TABLE notes;

-- ::
CREATE TABLE notes (
  id          TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE INDEX ON notes (user_id, updated_at DESC);
