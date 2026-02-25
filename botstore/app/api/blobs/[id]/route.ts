import { NextRequest, NextResponse } from 'next/server';
import { blobService } from '@/lib/container';
import { verifyJwt, extractBearer } from '@/lib/auth';
import { isValidBlobId, isValidContentType, sanitizeFilename } from '@/lib/validation';

// ── GET /api/blobs/:id — download ────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isValidBlobId(id)) {
    return NextResponse.json({ error: 'Invalid blob id' }, { status: 400 });
  }

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

  return new NextResponse(result.data as unknown as BodyInit, {
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

  if (!isValidBlobId(id)) {
    return NextResponse.json({ error: 'Invalid blob id' }, { status: 400 });
  }

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

  if (!isValidContentType(contentType)) {
    return NextResponse.json(
      { error: `Content-Type '${contentType.split(';')[0].trim()}' is not allowed` },
      { status: 400 },
    );
  }

  const rawFilename = req.headers.get('x-filename');
  const filename = rawFilename ? sanitizeFilename(rawFilename) || null : null;

  const MAX_BYTES = parseInt(process.env.MAX_BLOB_BYTES ?? String(50 * 1024 * 1024));
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_BYTES) {
    return NextResponse.json({ error: `Upload exceeds maximum size of ${MAX_BYTES} bytes` }, { status: 413 });
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: `Upload exceeds maximum size of ${MAX_BYTES} bytes` }, { status: 413 });
  }
  const result = blobService.upsert(id, identityId, buffer, contentType, filename);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { ok: _, ...blobData } = result;
  return NextResponse.json(blobData);
}

// ── DELETE /api/blobs/:id ─────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isValidBlobId(id)) {
    return NextResponse.json({ error: 'Invalid blob id' }, { status: 400 });
  }

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
