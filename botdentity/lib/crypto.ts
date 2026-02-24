import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from './db';

// ── Server signing secret ─────────────────────────────────────────────────────

let _secret: string | null = null;

export function getServerSecret(): string {
  if (_secret) return _secret;
  const row = db.prepare('SELECT secret FROM server_config WHERE id = ?').get('main') as
    | { secret: string }
    | undefined;
  if (row) {
    _secret = row.secret;
    return _secret;
  }
  const secret = crypto.randomBytes(64).toString('base64');
  db
    .prepare('INSERT INTO server_config (id, secret, created_at) VALUES (?, ?, ?)')
    .run('main', secret, new Date().toISOString());
  _secret = secret;
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

// ── JWT ───────────────────────────────────────────────────────────────────────

const VALIDITY_MAP: Record<string, string> = {
  '1h': '1h',
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
};

export function createToken(
  identityId: string,
  claims: Record<string, unknown>,
  validity: string = '24h',
): { token: string; expiresAt: string } {
  const expiresIn = VALIDITY_MAP[validity] ?? '24h';
  const secret = getServerSecret();
  const token = jwt.sign({ ...claims, sub: identityId }, secret, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    issuer: 'botdentity',
  });
  const decoded = jwt.decode(token) as { exp: number };
  return { token, expiresAt: new Date(decoded.exp * 1000).toISOString() };
}

export function verifyToken(token: string): { valid: true; claims: jwt.JwtPayload } | { valid: false; error: string } {
  try {
    const secret = getServerSecret();
    const claims = jwt.verify(token, secret, { issuer: 'botdentity' }) as jwt.JwtPayload;
    return { valid: true, claims };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}
