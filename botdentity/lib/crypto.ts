import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';

// ── Server signing secret ─────────────────────────────────────────────────────

export function getOrCreateServerSecret(db: DatabaseSync): string {
  const row = db.prepare('SELECT secret FROM server_config WHERE id = ?').get('main') as
    | { secret: string }
    | undefined;
  if (row) return row.secret;
  const secret = crypto.randomBytes(64).toString('base64');
  db
    .prepare('INSERT INTO server_config (id, secret, created_at) VALUES (?, ?, ?)')
    .run('main', secret, new Date().toISOString());
  return secret;
}

// ── Ed25519 keypair ───────────────────────────────────────────────────────────

export function generateKeypair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    publicKey: (publicKey as Buffer).toString('base64'),
    privateKey: (privateKey as Buffer).toString('base64'),
  };
}

export function verifySignature(
  message: string,
  signatureB64: string,
  publicKeyB64: string,
): boolean {
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, 'base64'),
      type: 'spki',
      format: 'der',
    });
    return crypto.verify(
      null,
      Buffer.from(message),
      publicKey,
      Buffer.from(signatureB64, 'base64'),
    );
  } catch {
    return false;
  }
}
