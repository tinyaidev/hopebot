import { NextRequest, NextResponse } from 'next/server';
import { jwtService } from '@/lib/container';

export async function POST(req: NextRequest) {
  let body: {
    identity_id?: string;
    signature?: string;
    claims?: Record<string, unknown>;
    validity?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { identity_id, signature, claims = {}, validity = '24h' } = body;

  if (!identity_id || !signature) {
    return NextResponse.json({ error: 'identity_id and signature are required' }, { status: 400 });
  }

  const result = jwtService.create(identity_id, signature, claims, validity);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ token: result.token, expires_at: result.expiresAt });
}
