CREATE TABLE IF NOT EXISTS omni_long_term_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  user_text TEXT NOT NULL,
  assistant_text TEXT NOT NULL,
  emotional_tone TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_omni_ltm_session_created
  ON omni_long_term_memory(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_omni_ltm_created
  ON omni_long_term_memory(created_at DESC);
