import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';
import { verifySignature } from '../crypto';
import type { Result } from './jwt';

const CREDITS_PER_PURCHASE = 1000;
const TIMESTAMP_WINDOW_MS = 60_000;

export function createCreditsService(db: DatabaseSync) {
  return {
    buy(
      identityId: string,
      signature: string,
      timestamp: number,
      slug: string,
    ): Result<{
      transactionId: string;
      creditsAdded: number;
      credits: number;
      slug: string;
      createdAt: string;
    }> {
      if (Math.abs(Date.now() - timestamp) > TIMESTAMP_WINDOW_MS) {
        return { ok: false, error: 'Request timestamp expired', status: 401 };
      }

      const identity = db
        .prepare('SELECT id, public_key, credits FROM identities WHERE id = ?')
        .get(identityId) as { id: string; public_key: string; credits: number } | undefined;

      if (!identity) {
        return { ok: false, error: 'Identity not found', status: 404 };
      }

      const message = `${identityId}:${String(timestamp)}`;
      if (!verifySignature(message, signature, identity.public_key)) {
        return { ok: false, error: 'Invalid signature', status: 401 };
      }

      const txId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO credit_transactions (id, identity_id, amount, slug, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(txId, identityId, CREDITS_PER_PURCHASE, slug, now);

      db.prepare('UPDATE identities SET credits = credits + ? WHERE id = ?').run(
        CREDITS_PER_PURCHASE,
        identityId,
      );

      const updated = db
        .prepare('SELECT credits FROM identities WHERE id = ?')
        .get(identityId) as { credits: number };

      return {
        ok: true,
        transactionId: txId,
        creditsAdded: CREDITS_PER_PURCHASE,
        credits: updated.credits,
        slug,
        createdAt: now,
      };
    },
  };
}
