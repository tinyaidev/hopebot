import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/container', () => ({
  creditsService: {
    buy: vi.fn(),
  },
}));

import { creditsService } from '@/lib/container';
import { POST } from '@/app/api/credits/buy/route';

const mockBuy = creditsService.buy as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/credits/buy', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/credits/buy', () => {
  it('returns 400 for missing fields', async () => {
    const res = await POST(makeRequest({}) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when slug is missing', async () => {
    const res = await POST(
      makeRequest({ identity_id: 'x', signature: 'y', timestamp: Date.now() }) as any,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when timestamp is missing', async () => {
    const res = await POST(
      makeRequest({ identity_id: 'x', signature: 'y', slug: 'z' }) as any,
    );
    expect(res.status).toBe(400);
  });

  it('propagates service error', async () => {
    mockBuy.mockReturnValue({ ok: false, error: 'Identity not found', status: 404 });
    const res = await POST(
      makeRequest({ identity_id: 'x', signature: 'y', timestamp: Date.now(), slug: 'z' }) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Identity not found');
  });

  it('propagates 401 from service', async () => {
    mockBuy.mockReturnValue({ ok: false, error: 'Invalid signature', status: 401 });
    const res = await POST(
      makeRequest({ identity_id: 'x', signature: 'bad', timestamp: Date.now(), slug: 'z' }) as any,
    );
    expect(res.status).toBe(401);
  });

  it('returns success shape', async () => {
    mockBuy.mockReturnValue({
      ok: true,
      transactionId: 'tx123',
      creditsAdded: 1000,
      credits: 1000,
      slug: 'test-slug',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    const res = await POST(
      makeRequest({
        identity_id: 'x',
        signature: 'y',
        timestamp: Date.now(),
        slug: 'test-slug',
      }) as any,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transaction_id).toBe('tx123');
    expect(body.credits_added).toBe(1000);
    expect(body.credits).toBe(1000);
    expect(body.slug).toBe('test-slug');
    expect(body.created_at).toBe('2024-01-01T00:00:00.000Z');
  });
});
