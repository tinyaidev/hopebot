import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '@/lib/schema';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach } from 'vitest';

export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
}

export function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'botstore-test-'));
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}
