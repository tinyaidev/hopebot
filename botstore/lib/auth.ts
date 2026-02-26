import jwt from 'jsonwebtoken';
import crypto from 'crypto';

function botdentityUrl(): string {
  return process.env.BOTDENTITY_URL ?? 'http://localhost:3001';
}

export interface JwtClaims {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  jti?: string;
  [key: string]: unknown;
}

interface JWK {
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid: string;
  use: string;
  alg: string;
}

let jwksCache: { keys: JWK[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL = 3_600_000; // 1 hour

async function fetchJwks(): Promise<JWK[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_CACHE_TTL) return jwksCache.keys;
  const res = await fetch(`${botdentityUrl()}/api/jwks`);
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
  const { keys } = (await res.json()) as { keys: JWK[] };
  jwksCache = { keys, fetchedAt: now };
  return keys;
}

export async function verifyJwt(
  token: string,
): Promise<{ valid: true; claims: JwtClaims } | { valid: false; error: string }> {
  try {
    const keys = await fetchJwks();
    const header = jwt.decode(token, { complete: true })?.header;
    const kid = header?.kid;
    const jwk = kid ? keys.find((k) => k.kid === kid) : keys[0];
    if (!jwk) return { valid: false, error: 'Signing key not found' };

    const publicKey = crypto.createPublicKey({ key: jwk as unknown as crypto.JsonWebKey, format: 'jwk' });
    const claims = jwt.verify(token, publicKey, {
      algorithms: ['ES256'],
      issuer: 'botdentity',
      audience: 'botstore',
    }) as JwtClaims;
    return { valid: true, claims };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
