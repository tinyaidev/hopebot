import { DatabaseSync } from 'node:sqlite';
import jwt from 'jsonwebtoken';
import { getOrCreateServerSecret, verifySignature } from '../crypto';

export type Result<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status: number };

const VALIDITY_MAP: Record<string, string> = {
  '1h': '1h',
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
};

export function createJwtService(db: DatabaseSync) {
  function secret(): string {
    return getOrCreateServerSecret(db);
  }

  return {
    create(
      identityId: string,
      signature: string,
      claims: Record<string, unknown>,
      validity: string,
    ): Result<{ token: string; expiresAt: string }> {
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

      if (!verifySignature(identityId, signature, identity.public_key)) {
        return { ok: false, error: 'Invalid signature', status: 401 };
      }

      const expiresIn = VALIDITY_MAP[validity];
      const token = jwt.sign({ ...claims, sub: identityId }, secret(), {
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
        issuer: 'botdentity',
      });
      const decoded = jwt.decode(token) as { exp: number };
      return { ok: true, token, expiresAt: new Date(decoded.exp * 1000).toISOString() };
    },

    verify(token: string): Result<{ claims: jwt.JwtPayload }> {
      try {
        const claims = jwt.verify(token, secret(), { issuer: 'botdentity' }) as jwt.JwtPayload;
        return { ok: true, claims };
      } catch (err) {
        return { ok: false, error: (err as Error).message, status: 401 };
      }
    },
  };
}
