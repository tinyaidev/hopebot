import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/container', () => ({
  jwtService: {
    create: vi.fn(),
    verify: vi.fn(),
  },
}));

import { jwtService } from '@/lib/container';
import { POST } from '@/app/api/jwt/route';
import { POST as POSTVerify } from '@/app/api/jwt/verify/route';

const mockCreate = jwtService.create as ReturnType<typeof vi.fn>;
const mockVerify = jwtService.verify as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/jwt', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/jwt', () => {
  it('returns 400 for missing fields', async () => {
    const res = await POST(makeRequest({}) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when only identity_id provided', async () => {
    const res = await POST(makeRequest({ identity_id: 'x' }) as any);
    expect(res.status).toBe(400);
  });

  it('propagates service error status', async () => {
    mockCreate.mockReturnValue({ ok: false, error: 'Identity not found', status: 404 });
    const res = await POST(makeRequest({ identity_id: 'x', signature: 'y' }) as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Identity not found');
  });

  it('returns token on success', async () => {
    mockCreate.mockReturnValue({ ok: true, token: 'tok123', expiresAt: '2025-01-01T00:00:00.000Z' });
    const res = await POST(makeRequest({ identity_id: 'x', signature: 'y' }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe('tok123');
    expect(body.expires_at).toBe('2025-01-01T00:00:00.000Z');
  });
});

describe('POST /api/jwt/verify', () => {
  it('returns 400 for missing token', async () => {
    const res = await POSTVerify(makeRequest({}) as any);
    expect(res.status).toBe(400);
  });

  it('returns 401 for invalid token', async () => {
    mockVerify.mockReturnValue({ ok: false, error: 'jwt malformed', status: 401 });
    const res = await POSTVerify(makeRequest({ token: 'bad' }) as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  it('returns 200 with claims for valid token', async () => {
    mockVerify.mockReturnValue({
      ok: true,
      claims: { sub: 'id123', iat: 1, exp: 9999999999, iss: 'botdentity' },
    });
    const res = await POSTVerify(makeRequest({ token: 'good' }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.claims.sub).toBe('id123');
  });
});
