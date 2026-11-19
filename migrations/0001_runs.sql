CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  fixture TEXT NOT NULL CHECK (fixture IN ('clean', 'review')),
  created_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'completed', 'failed')),
  result TEXT
);
CREATE INDEX runs_by_session ON runs (session, created_ms DESC);
CREATE UNIQUE INDEX one_queued_run ON runs (session, fixture) WHERE status = 'queued';
