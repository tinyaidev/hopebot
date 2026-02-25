export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS server_config (
    id TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public_key TEXT NOT NULL,
    credits INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    slug TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;
