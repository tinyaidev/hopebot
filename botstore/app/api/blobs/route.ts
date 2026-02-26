import { NextRequest, NextResponse } from 'next/server';
import { blobService } from '@/lib/container';
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
  const blobs = blobService.listByIdentity(identityId);

  return NextResponse.json({ blobs });
}
