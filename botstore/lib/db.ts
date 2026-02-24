import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'botstore.db'));

db.exec(`
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
`);

export { UPLOADS_DIR };
export default db;
