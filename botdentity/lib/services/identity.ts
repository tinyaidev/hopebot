import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';
import { generateKeypair } from '../crypto';
import { log } from '../logger';

export interface IdentityRow {
  id: string;
  name: string;
  public_key: string;
  credits: number;
  created_at: string;
}

export function createIdentityService(db: DatabaseSync) {
  return {
    create(name: string): IdentityRow & { private_key: string } {
      const id = uuidv4();
      const { publicKey, privateKey } = generateKeypair();
      const createdAt = new Date().toISOString();
      db.prepare(
        'INSERT INTO identities (id, name, public_key, credits, created_at) VALUES (?, ?, ?, 0, ?)',
      ).run(id, name, publicKey, createdAt);
      log('identity.created', { id, name });
      return {
        id,
        name,
        public_key: publicKey,
        private_key: privateKey,
        credits: 0,
        created_at: createdAt,
      };
    },

    getById(id: string): IdentityRow | undefined {
      return db
        .prepare('SELECT id, name, public_key, credits, created_at FROM identities WHERE id = ?')
        .get(id) as IdentityRow | undefined;
    },
  };
}
