import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifySignature, createToken } from '@/lib/crypto';

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

  const validities = ['1h', '24h', '7d', '30d'];
  if (!validities.includes(validity)) {
    return NextResponse.json(
      { error: `validity must be one of: ${validities.join(', ')}` },
      { status: 400 },
    );
  }

  const identity = db
    .prepare('SELECT id, public_key FROM identities WHERE id = ?')
    .get(identity_id) as { id: string; public_key: string } | undefined;

  if (!identity) {
    return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
  }

  if (!verifySignature(identity_id, signature, identity.public_key)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { token, expiresAt } = createToken(identity_id, claims, validity);

  return NextResponse.json({ token, expires_at: expiresAt });
}
