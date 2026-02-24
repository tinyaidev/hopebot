import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token } = body;
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const result = verifyToken(token);
  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 401 });
  }

  return NextResponse.json({ valid: true, claims: result.claims });
}
