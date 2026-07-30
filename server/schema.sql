-- LearnTrace database schema.
-- The `events` table is the clickstream store: a superset of the 7 Moodle
-- log columns (Time, Event context, Component, Event name, Description,
-- Origin, IP address), plus extra fields for richer in-app analytics.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'learner',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id       INTEGER PRIMARY KEY,
  code     TEXT NOT NULL,
  title    TEXT NOT NULL,
  summary  TEXT
);

-- kind: 'text' | 'video' | 'url'
CREATE TABLE IF NOT EXISTS lessons (
  id         INTEGER PRIMARY KEY,
  course_id  INTEGER NOT NULL REFERENCES courses(id),
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,          -- HTML/markdown-ish text for 'text' lessons
  media_url  TEXT,          -- video src for 'video', link for 'url'
  duration   INTEGER,       -- video length (seconds), optional
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quizzes (
  id         INTEGER PRIMARY KEY,
  course_id  INTEGER NOT NULL REFERENCES courses(id),
  title      TEXT NOT NULL,
  intro      TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id            INTEGER PRIMARY KEY,
  quiz_id       INTEGER NOT NULL REFERENCES quizzes(id),
  prompt        TEXT NOT NULL,
  options_json  TEXT NOT NULL,   -- JSON array of option strings
  correct_index INTEGER NOT NULL,
  marks         INTEGER NOT NULL DEFAULT 1,
  position      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attempts (
  id           INTEGER PRIMARY KEY,
  quiz_id      INTEGER NOT NULL REFERENCES quizzes(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  started_at   TEXT NOT NULL,
  submitted_at TEXT,
  score        INTEGER,
  max_score    INTEGER
);

CREATE TABLE IF NOT EXISTS answers (
  id           INTEGER PRIMARY KEY,
  attempt_id   INTEGER NOT NULL REFERENCES attempts(id),
  question_id  INTEGER NOT NULL REFERENCES questions(id),
  chosen_index INTEGER,
  correct      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,      -- random token stored in httpOnly cookie
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL,
  user_agent  TEXT,
  ip          TEXT
);

-- The clickstream. Every tracked action becomes one row here.
CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY,
  ts            TEXT NOT NULL,        -- ISO 8601 (server receive time)
  client_ts     TEXT,                 -- ISO 8601 (browser event time)
  user_id       INTEGER,              -- null for pre-login events
  session_id    TEXT,
  component     TEXT NOT NULL,        -- Moodle "Component" (System, Quiz, Media, URL, ...)
  event_name    TEXT NOT NULL,        -- Moodle "Event name"
  event_context TEXT NOT NULL,        -- Moodle "Event context"
  description   TEXT NOT NULL,        -- Moodle "Description" sentence
  origin        TEXT NOT NULL DEFAULT 'web',
  ip            TEXT,
  route         TEXT,                 -- SPA path where it happened
  target_type   TEXT,                 -- lesson | quiz | video | element | ...
  target_id     TEXT,
  meta          TEXT,                 -- JSON blob of extra detail
  user_agent    TEXT,
  viewport      TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts);
