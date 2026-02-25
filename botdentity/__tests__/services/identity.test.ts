import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers';
import { createIdentityService } from '@/lib/services/identity';

let service: ReturnType<typeof createIdentityService>;

beforeEach(() => {
  service = createIdentityService(createTestDb());
});

describe('identity.create', () => {
  it('returns id, keypair, and credits=0', () => {
    const result = service.create('TestBot');
    expect(result.id).toBeTruthy();
    expect(result.name).toBe('TestBot');
    expect(result.public_key).toBeTruthy();
    expect(result.private_key).toBeTruthy();
    expect(result.credits).toBe(0);
    expect(result.created_at).toBeTruthy();
  });

  it('does not store private_key in DB', () => {
    const result = service.create('TestBot');
    const row = service.getById(result.id);
    expect(row).toBeDefined();
    expect((row as unknown as Record<string, unknown>).private_key).toBeUndefined();
  });

  it('creates distinct identities', () => {
    const a = service.create('BotA');
    const b = service.create('BotB');
    expect(a.id).not.toBe(b.id);
    expect(a.public_key).not.toBe(b.public_key);
  });
});

describe('identity.getById', () => {
  it('returns undefined for missing id', () => {
    expect(service.getById('nonexistent')).toBeUndefined();
  });

  it('returns the identity for an existing id', () => {
    const created = service.create('Finder');
    const found = service.getById(created.id);
    expect(found?.name).toBe('Finder');
    expect(found?.id).toBe(created.id);
  });
});
