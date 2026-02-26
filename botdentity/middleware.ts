import { NextRequest, NextResponse } from 'next/server';

// In-memory sliding window rate limiter.
// Per-instance only — adequate for single-server deployment.
const windows = new Map<string, number[]>();

const LIMITS: { path: string; methods: string[]; limit: number; windowMs: number }[] = [
  { path: '/api/identity',    methods: ['POST'],         limit: 10,  windowMs: 60_000 },
  { path: '/api/jwt',         methods: ['POST'],         limit: 30,  windowMs: 60_000 },
  { path: '/api/credits/buy', methods: ['POST'],         limit: 10,  windowMs: 60_000 },
];

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
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();
  const ip = getIp(req);

  for (const rule of LIMITS) {
    if (pathname === rule.path && rule.methods.includes(method)) {
      if (!allow(ip, rule.path, rule.limit, rule.windowMs)) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(rule.windowMs / 1000)) } },
        );
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/identity', '/api/jwt', '/api/credits/buy'],
};
