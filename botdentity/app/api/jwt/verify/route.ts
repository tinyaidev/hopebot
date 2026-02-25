import { NextRequest, NextResponse } from 'next/server';
import { jwtService } from '@/lib/container';

export async function POST(req: NextRequest) {
  let body: { token?: string; audience?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token, audience } = body;
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const result = jwtService.verify(token, audience);
  if (!result.ok) {
    return NextResponse.json({ valid: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ valid: true, claims: result.claims });
}
