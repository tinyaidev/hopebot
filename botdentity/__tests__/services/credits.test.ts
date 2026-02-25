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
    const sig = signIdentityId(id, private_key);
    const result = creditsService.buy(id, sig, 'test-slug');
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
    const sig = signIdentityId(id, private_key);
    creditsService.buy(id, sig, 'slug-1');
    const result = creditsService.buy(id, sig, 'slug-2');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.credits).toBe(2000);
  });

  it('returns 404 for unknown identity', () => {
    const result = creditsService.buy('no-such-id', 'sig', 'slug');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('returns 401 for invalid signature', () => {
    const { id } = identityService.create('CreditBot');
    const result = creditsService.buy(id, 'badsig==', 'slug');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
