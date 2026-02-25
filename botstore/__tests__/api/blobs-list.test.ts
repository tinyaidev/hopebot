import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/container', () => ({
  blobService: {
    listByIdentity: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
  extractBearer: vi.fn(),
}));

import { blobService } from '@/lib/container';
import { verifyJwt, extractBearer } from '@/lib/auth';
import { GET } from '@/app/api/blobs/route';

const mockList = blobService.listByIdentity as ReturnType<typeof vi.fn>;
const mockVerify = verifyJwt as ReturnType<typeof vi.fn>;
const mockExtract = extractBearer as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(auth?: string): Request {
  return new Request('http://localhost/api/blobs', {
    headers: auth ? { Authorization: auth } : {},
  });
}

describe('GET /api/blobs', () => {
  it('returns 401 when no auth', async () => {
    mockExtract.mockReturnValue(null);
    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid JWT', async () => {
    mockExtract.mockReturnValue('bad-token');
    mockVerify.mockResolvedValue({ valid: false, error: 'bad token' });
    const res = await GET(makeRequest('Bearer bad-token') as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('bad token');
  });

  it('returns blob list on success', async () => {
    mockExtract.mockReturnValue('good-token');
    mockVerify.mockResolvedValue({
      valid: true,
      claims: { sub: 'identity-1', iat: 1, exp: 9999999999, iss: 'botdentity' },
    });
    mockList.mockReturnValue([
      { id: 'blob-1', identity_id: 'identity-1', filename: null, content_type: 'text/plain', size: 4, created_at: 'now', updated_at: 'now', last_transaction_at: null },
    ]);
    const res = await GET(makeRequest('Bearer good-token') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.blobs).toHaveLength(1);
    expect(body.blobs[0].id).toBe('blob-1');
    expect(mockList).toHaveBeenCalledWith('identity-1');
  });
});
