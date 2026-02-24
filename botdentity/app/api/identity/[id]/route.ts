import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = db
    .prepare('SELECT id, name, public_key, credits, created_at FROM identities WHERE id = ?')
    .get(id) as { id: string; name: string; public_key: string; credits: number; created_at: string } | undefined;

  if (!identity) {
    return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
  }

  return NextResponse.json(identity);
}
