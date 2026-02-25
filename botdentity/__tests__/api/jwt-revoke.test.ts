import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/container', () => ({
  jwtService: {
    verify: vi.fn(),
    revoke: vi.fn(),
  },
}));

import { jwtService } from '@/lib/container';
import { DELETE } from '@/app/api/jwt/[jti]/route';

const mockVerify = jwtService.verify as ReturnType<typeof vi.fn>;
const mockRevoke = jwtService.revoke as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(auth?: string): Request {
  return new Request('http://localhost/api/jwt/some-jti', {
    method: 'DELETE',
    headers: auth ? { Authorization: auth } : {},
  });
}

const mockParams = (jti: string) => Promise.resolve({ jti });

describe('DELETE /api/jwt/:jti', () => {
  it('returns 401 when no Authorization header', async () => {
    const res = await DELETE(makeRequest() as any, { params: mockParams('abc') });
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockVerify.mockReturnValue({ ok: false, error: 'jwt malformed', status: 401 });
    const res = await DELETE(makeRequest('Bearer bad') as any, { params: mockParams('abc') });
    expect(res.status).toBe(401);
  });

  it('returns 403 when token jti does not match URL param', async () => {
    mockVerify.mockReturnValue({
      ok: true,
      claims: { sub: 'user1', jti: 'different-jti' },
    });
    const res = await DELETE(makeRequest('Bearer tok') as any, { params: mockParams('abc') });
    expect(res.status).toBe(403);
  });

  it('revokes token and returns { revoked: true }', async () => {
    mockVerify.mockReturnValue({
      ok: true,
      claims: { sub: 'user1', jti: 'target-jti' },
    });
    mockRevoke.mockReturnValue({ ok: true });
    const res = await DELETE(makeRequest('Bearer tok') as any, {
      params: mockParams('target-jti'),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked).toBe(true);
    expect(mockRevoke).toHaveBeenCalledWith('target-jti', 'user1');
  });
});
