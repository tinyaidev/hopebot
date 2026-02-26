import { NextRequest, NextResponse } from 'next/server';
import { identityService } from '@/lib/container';

export async function POST(req: NextRequest) {
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name } = body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const result = identityService.create(name.trim());

  return NextResponse.json({
    ...result,
    note: 'The private_key is shown only once and never stored. Save it securely.',
  });
}
