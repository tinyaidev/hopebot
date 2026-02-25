export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS blobs (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    filename TEXT,
    content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    size INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_transaction_at TEXT
  );

  CREATE TABLE IF NOT EXISTS blob_transactions (
    id TEXT PRIMARY KEY,
    blob_id TEXT NOT NULL,
    size INTEGER NOT NULL,
    duration_seconds INTEGER,
    created_at TEXT NOT NULL
  );
`;
