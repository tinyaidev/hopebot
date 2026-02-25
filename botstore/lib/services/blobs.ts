import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../logger';

export interface BlobRow {
  id: string;
  identity_id: string;
  filename: string | null;
  content_type: string;
  size: number;
  created_at: string;
  updated_at: string;
  last_transaction_at: string | null;
}

export type Result<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status: number };

export function createBlobService(db: DatabaseSync, uploadsDir: string) {
  function filePath(id: string): string {
    return path.join(uploadsDir, id);
  }

  return {
    upsert(
      id: string,
      identityId: string,
      data: Buffer,
      contentType: string,
      filename: string | null,
    ): Result<BlobRow & { action: 'created' | 'updated' }> {
      const size = data.length;
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT * FROM blobs WHERE id = ?').get(id) as
        | BlobRow
        | undefined;

      if (existing) {
        if (existing.identity_id !== identityId) {
          log('blob.ownership_violation', { blobId: id, ownerId: existing.identity_id, requesterId: identityId });
          return { ok: false, error: 'Forbidden', status: 403 };
        }
        const lastTx = existing.last_transaction_at ?? existing.created_at;
        const durationSeconds = Math.floor(
          (new Date(now).getTime() - new Date(lastTx).getTime()) / 1000,
        );
        db.prepare(
          'INSERT INTO blob_transactions (id, blob_id, size, duration_seconds, created_at) VALUES (?, ?, ?, ?, ?)',
        ).run(uuidv4(), id, existing.size, durationSeconds, now);
        db.prepare(
          `UPDATE blobs SET filename = ?, content_type = ?, size = ?, updated_at = ?, last_transaction_at = ? WHERE id = ?`,
        ).run(filename, contentType, size, now, now, id);
      } else {
        db.prepare(
          `INSERT INTO blobs (id, identity_id, filename, content_type, size, created_at, updated_at, last_transaction_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        ).run(id, identityId, filename, contentType, size, now, now);
      }

      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(filePath(id), data);

      const updated = db.prepare('SELECT * FROM blobs WHERE id = ?').get(id) as unknown as BlobRow;
      return { ok: true, ...updated, action: existing ? 'updated' : 'created' };
    },

    getById(id: string): { blob: BlobRow; data: Buffer } | undefined {
      const blob = db.prepare('SELECT * FROM blobs WHERE id = ?').get(id) as BlobRow | undefined;
      if (!blob) return undefined;
      const fp = filePath(id);
      if (!fs.existsSync(fp)) return undefined;
      return { blob, data: fs.readFileSync(fp) };
    },

    listByIdentity(identityId: string): BlobRow[] {
      return db
        .prepare(
          `SELECT id, identity_id, filename, content_type, size, created_at, updated_at, last_transaction_at
           FROM blobs WHERE identity_id = ? ORDER BY updated_at DESC`,
        )
        .all(identityId) as unknown as BlobRow[];
    },

    deleteById(
      id: string,
      identityId: string,
    ): { ok: true } | { ok: false; error: string; status: number } {
      const blob = db.prepare('SELECT * FROM blobs WHERE id = ?').get(id) as BlobRow | undefined;
      if (!blob) return { ok: false, error: 'Blob not found', status: 404 };
      if (blob.identity_id !== identityId) {
        log('blob.ownership_violation', { blobId: id, ownerId: blob.identity_id, requesterId: identityId });
        return { ok: false, error: 'Forbidden', status: 403 };
      }
      const fp = filePath(id);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      db.prepare('DELETE FROM blobs WHERE id = ?').run(id);
      return { ok: true };
    },
  };
}
