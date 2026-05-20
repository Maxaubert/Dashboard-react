-- 002_plan_events_text_id.sql
-- Frontend uses UUID strings for plan event ids (client-generated, no
-- server roundtrip on create). Change plan_events.id from BIGSERIAL to
-- TEXT PRIMARY KEY so we can preserve those ids through the JSON-to-
-- Postgres data migration in Phase 4.
--
-- Table is empty in production (Phase 4 introduces the first writes),
-- so dropping and recreating is safe.

-- ::
DROP TABLE plan_events;

-- ::
CREATE TABLE plan_events (
  id          TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  tag         TEXT,
  location    TEXT,
  color       TEXT,
  recurring   BOOLEAN NOT NULL DEFAULT FALSE,
  position    INT NOT NULL DEFAULT 0
);

-- ::
CREATE INDEX ON plan_events (user_id, date);
