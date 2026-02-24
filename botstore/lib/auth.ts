/**
 * Verifies a JWT by calling botdentity's /api/jwt/verify endpoint.
 */

function botdentityUrl(): string {
  return process.env.BOTDENTITY_URL ?? 'http://localhost:3001';
}

export interface JwtClaims {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  [key: string]: unknown;
}

export async function verifyJwt(
  token: string,
): Promise<{ valid: true; claims: JwtClaims } | { valid: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${botdentityUrl()}/api/jwt/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    return { valid: false, error: `Could not reach botdentity: ${(err as Error).message}` };
  }

  const body = await res.json();
  if (!res.ok || !body.valid) {
    return { valid: false, error: body.error ?? 'Invalid token' };
  }
  return { valid: true, claims: body.claims as JwtClaims };
}

export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
