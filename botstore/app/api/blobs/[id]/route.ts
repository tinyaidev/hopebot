import { NextRequest, NextResponse } from 'next/server';
import { blobService } from '@/lib/container';
import { verifyJwt, extractBearer } from '@/lib/auth';

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

  const result = blobService.getById(id);
  if (!result) {
    return NextResponse.json({ error: 'Blob not found' }, { status: 404 });
  }

  return new NextResponse(result.data, {
    headers: {
      'Content-Type': result.blob.content_type,
      'Content-Length': String(result.blob.size),
      'X-Blob-Id': result.blob.id,
      'X-Identity-Id': result.blob.identity_id,
      ...(result.blob.filename
        ? { 'Content-Disposition': `attachment; filename="${result.blob.filename}"` }
        : {}),
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
  const result = blobService.upsert(id, identityId, buffer, contentType, filename);

  return NextResponse.json(result);
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
  const result = blobService.deleteById(id, identityId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ deleted: id });
}
