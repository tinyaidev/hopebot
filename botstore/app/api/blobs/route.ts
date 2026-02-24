import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyJwt, extractBearer } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = extractBearer(req.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Authorization: Bearer <token> required' }, { status: 401 });
  }

  const auth = await verifyJwt(token);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const identityId = auth.claims.sub;

  const blobs = db
    .prepare(
      `SELECT id, identity_id, filename, content_type, size, created_at, updated_at, last_transaction_at
       FROM blobs WHERE identity_id = ? ORDER BY updated_at DESC`,
    )
    .all(identityId) as {
    id: string;
    identity_id: string;
    filename: string | null;
    content_type: string;
    size: number;
    created_at: string;
    updated_at: string;
    last_transaction_at: string | null;
  }[];

  return NextResponse.json({ blobs });
}
