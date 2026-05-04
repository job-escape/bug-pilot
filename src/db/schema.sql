-- Global bot configuration
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Repository configurations
CREATE TABLE IF NOT EXISTS repos (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  github_owner   TEXT NOT NULL,
  base_branch    TEXT NOT NULL DEFAULT 'main',
  is_active      BOOLEAN NOT NULL DEFAULT false,
  repo_type      TEXT NOT NULL DEFAULT 'frontend',
  stack_tags     JSONB NOT NULL DEFAULT '[]',
  custom_prompt  TEXT,
  fix_model      TEXT,
  parser_model   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS threads (
  id                SERIAL PRIMARY KEY,
  slack_ts          TEXT NOT NULL UNIQUE,
  slack_permalink   TEXT NOT NULL,
  platform          TEXT NOT NULL,
  build             TEXT,
  environment       TEXT NOT NULL,
  feature           TEXT NOT NULL,
  parsed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  pr_url            TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  last_processed_ts TEXT NOT NULL DEFAULT '0',
  repo              TEXT NOT NULL DEFAULT '',
  user_context      TEXT
);

CREATE TABLE IF NOT EXISTS bugs (
  id              SERIAL PRIMARY KEY,
  thread_id       INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  image_url       TEXT,
  image_urls      TEXT[] DEFAULT '{}',
  file_path       TEXT,
  line_range      TEXT,
  rationale       TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  slack_permalink TEXT,
  user_note       TEXT
);

CREATE INDEX IF NOT EXISTS bugs_thread_id_idx ON bugs(thread_id);
CREATE INDEX IF NOT EXISTS threads_parsed_at_idx ON threads(parsed_at DESC);
CREATE INDEX IF NOT EXISTS threads_repo_idx ON threads(repo);
