import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '@/lib/schema';
import crypto from 'crypto';

export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
}

export function signIdentityId(id: string, privKeyB64: string): string {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privKeyB64, 'base64'),
    type: 'pkcs8',
    format: 'der',
  });
  return crypto.sign(null, Buffer.from(id), privateKey).toString('base64');
}
