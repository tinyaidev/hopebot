import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createTempDir } from '../helpers';
import { createBlobService } from '@/lib/services/blobs';
import fs from 'fs';
import path from 'path';

let blobService: ReturnType<typeof createBlobService>;
let uploadsDir: string;

beforeEach(() => {
  const db = createTestDb();
  uploadsDir = createTempDir();
  blobService = createBlobService(db, uploadsDir);
});

describe('blobService.upsert', () => {
  it('creates a new blob and writes file', () => {
    const data = Buffer.from('hello world');
    const result = blobService.upsert('blob-1', 'identity-1', data, 'text/plain', 'hello.txt');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action).toBe('created');
    expect(result.id).toBe('blob-1');
    expect(result.size).toBe(11);
    expect(result.filename).toBe('hello.txt');
    expect(fs.existsSync(path.join(uploadsDir, 'blob-1'))).toBe(true);
  });

  it('update creates a transaction record and updates metadata', () => {
    blobService.upsert('blob-1', 'identity-1', Buffer.from('v1'), 'text/plain', null);
    const result = blobService.upsert('blob-1', 'identity-1', Buffer.from('version 2'), 'text/plain', 'v2.txt');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action).toBe('updated');
    expect(result.size).toBe(9);
    expect(result.filename).toBe('v2.txt');
  });

  it('returns 403 when a different identity tries to overwrite an existing blob', () => {
    blobService.upsert('blob-owned', 'identity-1', Buffer.from('original'), 'text/plain', null);
    const result = blobService.upsert('blob-owned', 'identity-2', Buffer.from('evil'), 'text/plain', null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
    expect(result.error).toMatch(/forbidden/i);
    // Original file must be intact
    const stored = blobService.getById('blob-owned');
    expect(stored?.data.toString()).toBe('original');
  });
});

describe('blobService.getById', () => {
  it('retrieves stored data', () => {
    const data = Buffer.from('test data');
    blobService.upsert('blob-2', 'identity-1', data, 'application/octet-stream', null);
    const retrieved = blobService.getById('blob-2');
    expect(retrieved).toBeDefined();
    expect(retrieved!.data.toString()).toBe('test data');
    expect(retrieved!.blob.content_type).toBe('application/octet-stream');
  });

  it('returns undefined for missing blob', () => {
    expect(blobService.getById('no-such-blob')).toBeUndefined();
  });
});

describe('blobService.listByIdentity', () => {
  it('filters by identity', () => {
    blobService.upsert('a', 'identity-1', Buffer.from('a'), 'text/plain', null);
    blobService.upsert('b', 'identity-2', Buffer.from('b'), 'text/plain', null);
    blobService.upsert('c', 'identity-1', Buffer.from('c'), 'text/plain', null);
    const list = blobService.listByIdentity('identity-1');
    expect(list).toHaveLength(2);
    expect(list.map((b) => b.id).sort()).toEqual(['a', 'c']);
  });

  it('returns empty array when no blobs', () => {
    expect(blobService.listByIdentity('no-such-identity')).toHaveLength(0);
  });
});

describe('blobService.deleteById', () => {
  it('removes record and file', () => {
    blobService.upsert('blob-3', 'identity-1', Buffer.from('del me'), 'text/plain', null);
    const result = blobService.deleteById('blob-3', 'identity-1');
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, 'blob-3'))).toBe(false);
    expect(blobService.getById('blob-3')).toBeUndefined();
  });

  it('returns 403 for wrong identity', () => {
    blobService.upsert('blob-4', 'identity-1', Buffer.from('x'), 'text/plain', null);
    const result = blobService.deleteById('blob-4', 'identity-2');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('returns 404 for non-existent blob', () => {
    const result = blobService.deleteById('no-such-blob', 'identity-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});
