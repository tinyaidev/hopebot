import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db, { UPLOADS_DIR } from '@/lib/db';
import { verifyJwt, extractBearer } from '@/lib/auth';

type Blob = {
  id: string;
  identity_id: string;
  filename: string | null;
  content_type: string;
  size: number;
  created_at: string;
  updated_at: string;
  last_transaction_at: string | null;
};

function filePath(id: string): string {
  return path.join(UPLOADS_DIR, id);
}

// ── GET /api/blobs/:id — download ────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = extractBearer(req.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Authorization: Bearer <token> required' }, { status: 401 });
  }

  const auth = await verifyJwt(token);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const blob = db.prepare('SELECT * FROM blobs WHERE id = ?').get(id) as Blob | undefined;
  if (!blob) {
    return NextResponse.json({ error: 'Blob not found' }, { status: 404 });
  }

  const fp = filePath(id);
  if (!fs.existsSync(fp)) {
    return NextResponse.json({ error: 'File data missing' }, { status: 500 });
  }

  const data = fs.readFileSync(fp);
  return new NextResponse(data, {
    headers: {
      'Content-Type': blob.content_type,
      'Content-Length': String(blob.size),
      'X-Blob-Id': blob.id,
      'X-Identity-Id': blob.identity_id,
      ...(blob.filename ? { 'Content-Disposition': `attachment; filename="${blob.filename}"` } : {}),
    },
  });
}

// ── PUT /api/blobs/:id — upload or update ────────────────────────────────────

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = extractBearer(req.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Authorization: Bearer <token> required' }, { status: 401 });
  }

  const auth = await verifyJwt(token);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const identityId = auth.claims.sub;
  const contentType = req.headers.get('content-type') ?? 'application/octet-stream';
  const filename = req.headers.get('x-filename') ?? null;

  const buffer = Buffer.from(await req.arrayBuffer());
  const size = buffer.length;
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT * FROM blobs WHERE id = ?').get(id) as Blob | undefined;

  if (existing) {
    // Create a transaction record for the previous state before overwriting
    const lastTx = existing.last_transaction_at ?? existing.created_at;
    const durationSeconds = Math.floor(
      (new Date(now).getTime() - new Date(lastTx).getTime()) / 1000,
    );

    db.prepare(
      'INSERT INTO blob_transactions (id, blob_id, size, duration_seconds, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(uuidv4(), id, existing.size, durationSeconds, now);

    // Update blob metadata
    db.prepare(
      `UPDATE blobs SET filename = ?, content_type = ?, size = ?, updated_at = ?, last_transaction_at = ?
       WHERE id = ?`,
    ).run(filename, contentType, size, now, now, id);
  } else {
    // Create new blob record
    db.prepare(
      `INSERT INTO blobs (id, identity_id, filename, content_type, size, created_at, updated_at, last_transaction_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(id, identityId, filename, contentType, size, now, now);
  }

  // Write file to disk
  fs.writeFileSync(filePath(id), buffer);

  const updated = db.prepare('SELECT * FROM blobs WHERE id = ?').get(id) as Blob;

  return NextResponse.json({
    id: updated.id,
    identity_id: updated.identity_id,
    filename: updated.filename,
    content_type: updated.content_type,
    size: updated.size,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
    last_transaction_at: updated.last_transaction_at,
    action: existing ? 'updated' : 'created',
  });
}

// ── DELETE /api/blobs/:id ─────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = extractBearer(req.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Authorization: Bearer <token> required' }, { status: 401 });
  }

  const auth = await verifyJwt(token);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const identityId = auth.claims.sub;
  const blob = db.prepare('SELECT * FROM blobs WHERE id = ?').get(id) as Blob | undefined;

  if (!blob) {
    return NextResponse.json({ error: 'Blob not found' }, { status: 404 });
  }

  if (blob.identity_id !== identityId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fp = filePath(id);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  db.prepare('DELETE FROM blobs WHERE id = ?').run(id);

  return NextResponse.json({ deleted: id });
}
