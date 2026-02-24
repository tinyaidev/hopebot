import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { generateKeypair } from '@/lib/crypto';

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

  const id = uuidv4();
  const { publicKey, privateKey } = generateKeypair();
  const createdAt = new Date().toISOString();

  db.prepare(
    'INSERT INTO identities (id, name, public_key, credits, created_at) VALUES (?, ?, ?, 0, ?)',
  ).run(id, name.trim(), publicKey, createdAt);

  return NextResponse.json({
    id,
    name: name.trim(),
    public_key: publicKey,
    private_key: privateKey,
    credits: 0,
    created_at: createdAt,
    note: 'The private_key is shown only once and never stored. Save it securely.',
  });
}
