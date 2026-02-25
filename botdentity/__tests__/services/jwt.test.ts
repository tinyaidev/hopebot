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
    const sig = signIdentityId(id, private_key);
    const result = jwtService.create(id, sig, {}, '24h');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.token).toBe('string');
      expect(result.expiresAt).toBeTruthy();
    }
  });

  it('returns 404 for unknown identity', () => {
    const result = jwtService.create('no-such-id', 'sig', {}, '24h');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('returns 401 for bad signature', () => {
    const { id } = identityService.create('JwtBot');
    const result = jwtService.create(id, 'badsig==', {}, '24h');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it('returns 400 for invalid validity', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const sig = signIdentityId(id, private_key);
    const result = jwtService.create(id, sig, {}, '999d');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it.each(['1h', '24h', '7d', '30d'])('accepts validity %s', (validity) => {
    const { id, private_key } = identityService.create('JwtBot');
    const sig = signIdentityId(id, private_key);
    const result = jwtService.create(id, sig, {}, validity);
    expect(result.ok).toBe(true);
  });

  it('returns 400 when exp is in claims (would crash jwt.sign)', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const sig = signIdentityId(id, private_key);
    const result = jwtService.create(id, sig, { exp: 99999999 }, '1h');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/reserved/i);
    }
  });

  it('returns 400 when nbf is in claims (would crash jwt.sign)', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const sig = signIdentityId(id, private_key);
    const result = jwtService.create(id, sig, { nbf: 0 }, '1h');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('sub in claims is silently overridden — token sub is always the real identity id', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const sig = signIdentityId(id, private_key);
    const result = jwtService.create(id, sig, { sub: 'evil-identity' }, '1h');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verified = jwtService.verify(result.token);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.claims.sub).toBe(id);
  });

  it('iss in claims is stripped — token iss is always botdentity', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const sig = signIdentityId(id, private_key);
    const result = jwtService.create(id, sig, { iss: 'evil-issuer' }, '1h');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verified = jwtService.verify(result.token);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.claims.iss).toBe('botdentity');
  });

  it('preserves extra claims', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const sig = signIdentityId(id, private_key);
    const result = jwtService.create(id, sig, { role: 'admin' }, '1h');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const verified = jwtService.verify(result.token);
      expect(verified.ok).toBe(true);
      if (verified.ok) expect(verified.claims.role).toBe('admin');
    }
  });
});

describe('jwt.verify', () => {
  it('verifies a valid token', () => {
    const { id, private_key } = identityService.create('JwtBot');
    const sig = signIdentityId(id, private_key);
    const created = jwtService.create(id, sig, {}, '1h');
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
