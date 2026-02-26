import { NextRequest, NextResponse } from 'next/server';
import { identityService } from '@/lib/container';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = identityService.getById(id);

  if (!identity) {
    return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
  }

  return NextResponse.json(identity);
}
