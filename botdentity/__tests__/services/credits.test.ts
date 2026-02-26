import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, signIdentityId } from '../helpers';
import { createIdentityService } from '@/lib/services/identity';
import { createCreditsService } from '@/lib/services/credits';

let identityService: ReturnType<typeof createIdentityService>;
let creditsService: ReturnType<typeof createCreditsService>;

beforeEach(() => {
  const db = createTestDb();
  identityService = createIdentityService(db);
  creditsService = createCreditsService(db);
});

describe('credits.buy', () => {
  it('grants 1000 credits', () => {
    const { id, private_key } = identityService.create('CreditBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    const result = creditsService.buy(id, sig, ts, 'test-slug');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.creditsAdded).toBe(1000);
      expect(result.credits).toBe(1000);
      expect(result.slug).toBe('test-slug');
      expect(result.transactionId).toBeTruthy();
      expect(result.createdAt).toBeTruthy();
    }
  });

  it('accumulates on repeat purchase', () => {
    const { id, private_key } = identityService.create('CreditBot');
    const ts = Date.now();
    const sig = signIdentityId(id, private_key, ts);
    creditsService.buy(id, sig, ts, 'slug-1');
    const result = creditsService.buy(id, sig, ts, 'slug-2');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.credits).toBe(2000);
  });

  it('returns 401 for expired timestamp (replay protection)', () => {
    const { id, private_key } = identityService.create('CreditBot');
    const ts = Date.now() - 90_000; // 90 seconds ago
    const sig = signIdentityId(id, private_key, ts);
    const result = creditsService.buy(id, sig, ts, 'slug');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/timestamp/i);
    }
  });

  it('returns 404 for unknown identity', () => {
    const ts = Date.now();
    const result = creditsService.buy('no-such-id', 'sig', ts, 'slug');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('returns 401 for invalid signature', () => {
    const { id } = identityService.create('CreditBot');
    const ts = Date.now();
    const result = creditsService.buy(id, 'badsig==', ts, 'slug');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
