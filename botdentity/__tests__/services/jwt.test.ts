import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, signIdentityId } from '../helpers';
import { createIdentityService } from '@/lib/services/identity';
import { createJwtService } from '@/lib/services/jwt';

let identityService: ReturnType<typeof createIdentityService>;
let jwtService: ReturnType<typeof createJwtService>;

beforeEach(() => {
  const db = createTestDb();
  identityService = createIdentityService(db);
  jwtService = createJwtService(db);
});

describe('jwt.create', () => {
  it('returns token and expiresAt for valid request', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, {}, '24h');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.token).toBe('string');
      expect(result.expiresAt).toBeTruthy();
    }
  });

  it('returns 401 for expired timestamp', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now() - 90_000; // 90 seconds ago
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, {}, '24h');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/timestamp/i);
    }
  });

  it('returns 401 for future timestamp beyond window', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now() + 90_000; // 90 seconds in future
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, {}, '24h');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it('returns 404 for unknown identity', () => {
    const ts = Date.now();
    const result = jwtService.create('no-such-id', 'sig', ts, {}, '24h');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('returns 401 for bad signature', () => {
    const { id } = identityService.create('JwtBot');
    const ts = Date.now();
    const result = jwtService.create(id, 'badsig==', ts, {}, '24h');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it('returns 400 for invalid validity', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, {}, '999d');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it.each(['1h', '24h', '7d', '30d'])('accepts validity %s', (validity) => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, {}, validity);
    expect(result.ok).toBe(true);
  });

  it('returns 400 when exp is in claims (would crash jwt.sign)', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, { exp: 99999999 }, '1h');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/reserved/i);
    }
  });

  it('returns 400 when nbf is in claims (would crash jwt.sign)', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, { nbf: 0 }, '1h');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('sub in claims is silently overridden — token sub is always the real identity id', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, { sub: 'evil-identity' }, '1h');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verified = jwtService.verify(result.token);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.claims.sub).toBe(id);
  });

  it('iss in claims is stripped — token iss is always botdentity', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, { iss: 'evil-issuer' }, '1h');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verified = jwtService.verify(result.token);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.claims.iss).toBe('botdentity');
  });

  it('preserves extra claims', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, { role: 'admin' }, '1h');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const verified = jwtService.verify(result.token);
      expect(verified.ok).toBe(true);
      if (verified.ok) expect(verified.claims.role).toBe('admin');
    }
  });

  it('sets aud claim when audience is provided', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, {}, '1h', 'botstore');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verified = jwtService.verify(result.token, 'botstore');
    expect(verified.ok).toBe(true);
  });

  it('verify with wrong audience returns 401', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, {}, '1h', 'botstore');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verified = jwtService.verify(result.token, 'wrong-service');
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.status).toBe(401);
  });

  it('token includes jti claim', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = jwtService.create(id, sig, ts, {}, '1h');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verified = jwtService.verify(result.token);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.claims.jti).toBeTruthy();
  });
});

describe('jwt.verify', () => {
  it('verifies a valid token', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const created = jwtService.create(id, sig, ts, {}, '1h');
    if (!created.ok) throw new Error('create failed');
    const result = jwtService.verify(created.token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.claims.sub).toBe(id);
  });

  it('returns error for tampered token', () => {
    const result = jwtService.verify('bad.token.here');
    expect(result.ok).toBe(false);
  });
});

describe('jwt.revoke', () => {
  it('revoked token fails verify', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const created = jwtService.create(id, sig, ts, {}, '1h');
    if (!created.ok) throw new Error('create failed');

    const before = jwtService.verify(created.token);
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    jwtService.revoke(before.claims.jti as string, id);

    const after = jwtService.verify(created.token);
    expect(after.ok).toBe(false);
    if (!after.ok) {
      expect(after.status).toBe(401);
      expect(after.error).toMatch(/revoked/i);
    }
  });

  it('revoke is idempotent', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const created = jwtService.create(id, sig, ts, {}, '1h');
    if (!created.ok) throw new Error('create failed');
    const verified = jwtService.verify(created.token);
    if (!verified.ok) throw new Error('verify failed');
    const jti = verified.claims.jti as string;

    jwtService.revoke(jti, id);
    const result = jwtService.revoke(jti, id);
    expect(result.ok).toBe(true);
  });
});
