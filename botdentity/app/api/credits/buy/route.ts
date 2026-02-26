import { NextRequest, NextResponse } from 'next/server';
import { creditsService } from '@/lib/container';

export async function POST(req: NextRequest) {
  let body: { identity_id?: string; signature?: string; timestamp?: number; slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { identity_id, signature, timestamp, slug } = body;

  if (!identity_id || !signature || !slug || typeof timestamp !== 'number') {
    return NextResponse.json(
      { error: 'identity_id, signature, timestamp, and slug are required' },
      { status: 400 },
    );
  }

  const result = creditsService.buy(identity_id, signature, timestamp, slug);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    transaction_id: result.transactionId,
    credits_added: result.creditsAdded,
    credits: result.credits,
    slug: result.slug,
    created_at: result.createdAt,
  });
}
