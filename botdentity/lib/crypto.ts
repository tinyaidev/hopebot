import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';

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

// ── EC P-256 signing key ──────────────────────────────────────────────────────

interface SigningKeyRow {
  kid: string;
  public_key: string;
  private_key: string;
}

export function getOrCreateSigningKey(db: DatabaseSync): {
  kid: string;
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
} {
  const row = db
    .prepare('SELECT kid, public_key, private_key FROM signing_keys LIMIT 1')
    .get() as SigningKeyRow | undefined;

  if (row) {
    return {
      kid: row.kid,
      privateKey: crypto.createPrivateKey(row.private_key),
      publicKey: crypto.createPublicKey(row.public_key),
    };
  }

  const { privateKey: privatePem, publicKey: publicPem } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }) as { privateKey: string; publicKey: string };

  const kid = uuidv4();
  db.prepare(
    'INSERT INTO signing_keys (kid, public_key, private_key, algorithm, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(kid, publicPem, privatePem, 'ES256', new Date().toISOString());

  return {
    kid,
    privateKey: crypto.createPrivateKey(privatePem),
    publicKey: crypto.createPublicKey(publicPem),
  };
}
