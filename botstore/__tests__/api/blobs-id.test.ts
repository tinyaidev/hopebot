import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/container', () => ({
  blobService: {
    upsert: vi.fn(),
    getById: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
  extractBearer: vi.fn(),
}));

import { blobService } from '@/lib/container';
import { verifyJwt, extractBearer } from '@/lib/auth';
import { PUT, GET, DELETE } from '@/app/api/blobs/[id]/route';

const mockUpsert = blobService.upsert as ReturnType<typeof vi.fn>;
const mockGetById = blobService.getById as ReturnType<typeof vi.fn>;
const mockDelete = blobService.deleteById as ReturnType<typeof vi.fn>;
const mockVerify = verifyJwt as ReturnType<typeof vi.fn>;
const mockExtract = extractBearer as ReturnType<typeof vi.fn>;

const params = { params: Promise.resolve({ id: 'blob-1' }) };
const goodAuth = {
  valid: true,
  claims: { sub: 'identity-1', iat: 1, exp: 9999999999, iss: 'botdentity' },
};
const goodUpsertResult = {
  ok: true,
  id: 'blob-1',
  identity_id: 'identity-1',
  filename: null,
  content_type: 'application/octet-stream',
  size: 4,
  created_at: 'now',
  updated_at: 'now',
  last_transaction_at: null,
  action: 'created',
};

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(method: string, body?: BodyInit, headers?: Record<string, string>): Request {
  return new Request('http://localhost/api/blobs/blob-1', { method, body, headers });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

describe('PUT /api/blobs/:id', () => {
  it('returns 400 for invalid blob id (path traversal)', async () => {
    const badParams = { params: Promise.resolve({ id: '../etc/passwd' }) };
    const res = await PUT(makeRequest('PUT', Buffer.from('data')) as any, badParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid blob id/i);
  });

  it('returns 400 for id with dot prefix', async () => {
    const badParams = { params: Promise.resolve({ id: '.hidden' }) };
    const res = await PUT(makeRequest('PUT', Buffer.from('data')) as any, badParams);
    expect(res.status).toBe(400);
  });

  it('returns 401 when no auth', async () => {
    mockExtract.mockReturnValue(null);
    const res = await PUT(makeRequest('PUT', Buffer.from('data')) as any, params);
    expect(res.status).toBe(401);
  });

  it('returns 400 for blocked content-type text/html', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    const res = await PUT(
      makeRequest('PUT', Buffer.from('<h1>xss</h1>'), {
        Authorization: 'Bearer tok',
        'Content-Type': 'text/html',
      }) as any,
      params,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not allowed/i);
  });

  it('returns 400 for blocked content-type application/javascript', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    const res = await PUT(
      makeRequest('PUT', Buffer.from('alert(1)'), {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/javascript',
      }) as any,
      params,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for blocked content-type image/svg+xml', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    const res = await PUT(
      makeRequest('PUT', Buffer.from('<svg/>'), {
        Authorization: 'Bearer tok',
        'Content-Type': 'image/svg+xml',
      }) as any,
      params,
    );
    expect(res.status).toBe(400);
  });

  it('strips backslashes from filename before passing to service', async () => {
    // Note: \n/\r/\0 in header values are rejected by the HTTP API itself (tested in
    // validation.test.ts). Backslash is a valid header value but stripped by sanitizeFilename.
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    mockUpsert.mockReturnValue(goodUpsertResult);
    const res = await PUT(
      makeRequest('PUT', Buffer.from('data'), {
        Authorization: 'Bearer tok',
        'x-filename': 'path\\file.txt',
      }) as any,
      params,
    );
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      'blob-1',
      'identity-1',
      expect.any(Buffer),
      'application/octet-stream',
      'pathfile.txt',
    );
  });

  it('strips quotes from filename', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    mockUpsert.mockReturnValue(goodUpsertResult);
    await PUT(
      makeRequest('PUT', Buffer.from('data'), {
        Authorization: 'Bearer tok',
        'x-filename': 'file"name.txt',
      }) as any,
      params,
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      'blob-1', 'identity-1', expect.any(Buffer), 'application/octet-stream', 'filename.txt',
    );
  });

  it('returns 403 when service rejects cross-identity overwrite', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    mockUpsert.mockReturnValue({ ok: false, error: 'Forbidden', status: 403 });
    const res = await PUT(
      makeRequest('PUT', Buffer.from('data'), { Authorization: 'Bearer tok' }) as any,
      params,
    );
    expect(res.status).toBe(403);
  });

  it('returns action: created on success (ok field not in response)', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    mockUpsert.mockReturnValue(goodUpsertResult);
    const res = await PUT(
      makeRequest('PUT', Buffer.from('data'), { Authorization: 'Bearer tok' }) as any,
      params,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('created');
    expect(body.id).toBe('blob-1');
    expect(body.ok).toBeUndefined();
  });
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/blobs/:id', () => {
  it('returns 400 for invalid blob id', async () => {
    const badParams = { params: Promise.resolve({ id: '../secret' }) };
    const res = await GET(makeRequest('GET') as any, badParams);
    expect(res.status).toBe(400);
  });

  it('returns 401 when no auth', async () => {
    mockExtract.mockReturnValue(null);
    const res = await GET(makeRequest('GET') as any, params);
    expect(res.status).toBe(401);
  });

  it('returns 404 when blob not found', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    mockGetById.mockReturnValue(undefined);
    const res = await GET(
      makeRequest('GET', undefined, { Authorization: 'Bearer tok' }) as any,
      params,
    );
    expect(res.status).toBe(404);
  });

  it('returns raw bytes with correct content-type on success', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    mockGetById.mockReturnValue({
      blob: {
        id: 'blob-1',
        identity_id: 'identity-1',
        filename: null,
        content_type: 'text/plain',
        size: 4,
        created_at: 'now',
        updated_at: 'now',
        last_transaction_at: null,
      },
      data: Buffer.from('test'),
    });
    const res = await GET(
      makeRequest('GET', undefined, { Authorization: 'Bearer tok' }) as any,
      params,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(res.headers.get('x-blob-id')).toBe('blob-1');
    const text = await res.text();
    expect(text).toBe('test');
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/blobs/:id', () => {
  it('returns 400 for invalid blob id', async () => {
    const badParams = { params: Promise.resolve({ id: '../secret' }) };
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    const res = await DELETE(makeRequest('DELETE') as any, badParams);
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing blob', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    mockDelete.mockReturnValue({ ok: false, error: 'Blob not found', status: 404 });
    const res = await DELETE(
      makeRequest('DELETE', undefined, { Authorization: 'Bearer tok' }) as any,
      params,
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 for wrong identity', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    mockDelete.mockReturnValue({ ok: false, error: 'Forbidden', status: 403 });
    const res = await DELETE(
      makeRequest('DELETE', undefined, { Authorization: 'Bearer tok' }) as any,
      params,
    );
    expect(res.status).toBe(403);
  });

  it('returns deleted id on success', async () => {
    mockExtract.mockReturnValue('tok');
    mockVerify.mockResolvedValue(goodAuth);
    mockDelete.mockReturnValue({ ok: true });
    const res = await DELETE(
      makeRequest('DELETE', undefined, { Authorization: 'Bearer tok' }) as any,
      params,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe('blob-1');
  });
});
