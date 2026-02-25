import { NextRequest, NextResponse } from 'next/server';
import { jwtService } from '@/lib/container';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jti: string }> },
) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
  }

  const verified = jwtService.verify(token);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  const { jti } = await params;
  if (verified.claims.jti !== jti) {
    return NextResponse.json({ error: 'Token jti does not match' }, { status: 403 });
  }

  jwtService.revoke(jti, verified.claims.sub as string);
  return NextResponse.json({ revoked: true });
}
