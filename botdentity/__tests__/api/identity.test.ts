import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/container', () => ({
  identityService: {
    create: vi.fn(),
    getById: vi.fn(),
  },
}));

import { identityService } from '@/lib/container';
import { POST } from '@/app/api/identity/route';
import { GET } from '@/app/api/identity/[id]/route';

const mockCreate = identityService.create as ReturnType<typeof vi.fn>;
const mockGetById = identityService.getById as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function makePost(body: unknown): Request {
  return new Request('http://localhost/api/identity', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/identity', () => {
  it('returns 400 for missing name', async () => {
    const res = await POST(makePost({}) as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/identity', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns created identity on success', async () => {
    const identity = {
      id: 'abc123',
      name: 'TestBot',
      public_key: 'pk',
      private_key: 'sk',
      credits: 0,
      created_at: '2024-01-01T00:00:00.000Z',
    };
    mockCreate.mockReturnValue(identity);
    const res = await POST(makePost({ name: 'TestBot' }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('abc123');
    expect(body.note).toBeTruthy();
    expect(mockCreate).toHaveBeenCalledWith('TestBot');
  });
});

describe('GET /api/identity/[id]', () => {
  it('returns 200 for found identity', async () => {
    mockGetById.mockReturnValue({
      id: 'abc123',
      name: 'TestBot',
      public_key: 'pk',
      credits: 0,
      created_at: '2024-01-01T00:00:00.000Z',
    });
    const req = new Request('http://localhost/api/identity/abc123');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'abc123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('abc123');
  });

  it('returns 404 for missing identity', async () => {
    mockGetById.mockReturnValue(undefined);
    const req = new Request('http://localhost/api/identity/missing');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });
});
