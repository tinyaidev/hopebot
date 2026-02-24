import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { verifySignature } from '@/lib/crypto';

const CREDITS_PER_PURCHASE = 1000;

export async function POST(req: NextRequest) {
  let body: { identity_id?: string; signature?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { identity_id, signature, slug } = body;

  if (!identity_id || !signature || !slug) {
    return NextResponse.json(
      { error: 'identity_id, signature, and slug are required' },
      { status: 400 },
    );
  }

  const identity = db
    .prepare('SELECT id, public_key, credits FROM identities WHERE id = ?')
    .get(identity_id) as { id: string; public_key: string; credits: number } | undefined;

  if (!identity) {
    return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
  }

  if (!verifySignature(identity_id, signature, identity.public_key)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const txId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO credit_transactions (id, identity_id, amount, slug, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(txId, identity_id, CREDITS_PER_PURCHASE, slug, now);

  db.prepare('UPDATE identities SET credits = credits + ? WHERE id = ?').run(
    CREDITS_PER_PURCHASE,
    identity_id,
  );

  const updated = db
    .prepare('SELECT credits FROM identities WHERE id = ?')
    .get(identity_id) as { credits: number };

  return NextResponse.json({
    transaction_id: txId,
    credits_added: CREDITS_PER_PURCHASE,
    credits: updated.credits,
    slug,
    created_at: now,
  });
}
