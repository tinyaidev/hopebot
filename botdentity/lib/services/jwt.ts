import { DatabaseSync } from 'node:sqlite';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getOrCreateSigningKey, verifySignature } from '../crypto';
import { log } from '../logger';

export type Result<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status: number };

const VALIDITY_MAP: Record<string, string> = {
  '1h': '1h',
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
};

// Claims that would cause jwt.sign to throw when also set via options.
const CRASH_CLAIMS = new Set(['exp', 'nbf']);
// Claims that jwt options set authoritatively — strip from user payload to avoid confusion.
const STRIP_CLAIMS = new Set(['iat', 'iss', 'jti', 'aud']);

const TIMESTAMP_WINDOW_MS = 60_000;

export function createJwtService(db: DatabaseSync) {
  return {
    create(
      identityId: string,
      signature: string,
      timestamp: number,
      claims: Record<string, unknown>,
      validity: string,
      audience?: string,
    ): Result<{ token: string; expiresAt: string }> {
      if (Math.abs(Date.now() - timestamp) > TIMESTAMP_WINDOW_MS) {
        return { ok: false, error: 'Request timestamp expired', status: 401 };
      }

      if (!VALIDITY_MAP[validity]) {
        return {
          ok: false,
          error: `validity must be one of: ${Object.keys(VALIDITY_MAP).join(', ')}`,
          status: 400,
        };
      }

      const identity = db
        .prepare('SELECT id, public_key FROM identities WHERE id = ?')
        .get(identityId) as { id: string; public_key: string } | undefined;

      if (!identity) {
        return { ok: false, error: 'Identity not found', status: 404 };
      }

      const message = `${identityId}:${String(timestamp)}`;
      if (!verifySignature(message, signature, identity.public_key)) {
        return { ok: false, error: 'Invalid signature', status: 401 };
      }

      const crashFound = Object.keys(claims).filter((k) => CRASH_CLAIMS.has(k));
      if (crashFound.length > 0) {
        return {
          ok: false,
          error: `Reserved JWT claims not allowed in custom claims: ${crashFound.join(', ')}`,
          status: 400,
        };
      }

      const safeClaims = Object.fromEntries(
        Object.entries(claims).filter(([k]) => !STRIP_CLAIMS.has(k)),
      );

      const { kid, privateKey } = getOrCreateSigningKey(db);
      const jti = uuidv4();
      const expiresIn = VALIDITY_MAP[validity];
      const signOptions: jwt.SignOptions = {
        algorithm: 'ES256',
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
        issuer: 'botdentity',
        jwtid: jti,
        keyid: kid,
      };
      if (audience) signOptions.audience = audience;

      const token = jwt.sign({ ...safeClaims, sub: identityId }, privateKey, signOptions);
      const decoded = jwt.decode(token) as { exp: number };
      log('jwt.created', { identityId, jti, validity, audience });
      return { ok: true, token, expiresAt: new Date(decoded.exp * 1000).toISOString() };
    },

    verify(token: string, audience?: string): Result<{ claims: jwt.JwtPayload }> {
      try {
        const { publicKey } = getOrCreateSigningKey(db);
        const verifyOptions: jwt.VerifyOptions = {
          issuer: 'botdentity',
          algorithms: ['ES256'],
        };
        if (audience) verifyOptions.audience = audience;

        const claims = jwt.verify(token, publicKey, verifyOptions) as jwt.JwtPayload;

        if (claims.jti) {
          const revoked = db
            .prepare('SELECT jti FROM jti_revocations WHERE jti = ?')
            .get(claims.jti);
          if (revoked) {
            return { ok: false, error: 'Token has been revoked', status: 401 };
          }
        }

        return { ok: true, claims };
      } catch (err) {
        return { ok: false, error: (err as Error).message, status: 401 };
      }
    },

    revoke(jti: string, identityId: string): Result<object> {
      const existing = db.prepare('SELECT jti FROM jti_revocations WHERE jti = ?').get(jti);
      if (existing) return { ok: true };
      db.prepare(
        'INSERT INTO jti_revocations (jti, identity_id, created_at) VALUES (?, ?, ?)',
      ).run(jti, identityId, new Date().toISOString());
      log('jwt.revoked', { jti, identityId });
      return { ok: true };
    },
  };
}
