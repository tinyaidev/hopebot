import { NextRequest, NextResponse } from 'next/server';

const windows = new Map<string, number[]>();

const BLOB_PUT_LIMIT = 60;
const BLOB_PUT_WINDOW_MS = 60_000;

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
}

function allow(ip: string, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const k = `${ip}:${key}`;
  const timestamps = (windows.get(k) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= limit) {
    windows.set(k, timestamps);
    return false;
  }
  timestamps.push(now);
  windows.set(k, timestamps);
  return true;
}

export function middleware(req: NextRequest) {
  if (req.method === 'PUT') {
    const ip = getIp(req);
    if (!allow(ip, 'blob-put', BLOB_PUT_LIMIT, BLOB_PUT_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/blobs/:path*'],
};
