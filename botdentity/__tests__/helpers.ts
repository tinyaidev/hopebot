import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '@/lib/schema';
import crypto from 'crypto';

export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
}

export function signIdentityId(id: string, privKeyB64: string, timestamp: number): string {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privKeyB64, 'base64'),
    type: 'pkcs8',
    format: 'der',
  });
  const message = `${id}:${String(timestamp)}`;
  return crypto.sign(null, Buffer.from(message), privateKey).toString('base64');
}
