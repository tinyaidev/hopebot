import { describe, it, expect } from 'vitest';
import { isValidBlobId, isValidContentType, sanitizeFilename } from '@/lib/validation';

describe('isValidBlobId', () => {
  it('accepts UUIDs', () => {
    expect(isValidBlobId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts alphanumeric slugs', () => {
    expect(isValidBlobId('my-blob-123')).toBe(true);
    expect(isValidBlobId('blob_a')).toBe(true);
    expect(isValidBlobId('a')).toBe(true);
  });

  it('rejects path traversal sequences', () => {
    expect(isValidBlobId('../etc/passwd')).toBe(false);
    expect(isValidBlobId('../../secret')).toBe(false);
    expect(isValidBlobId('./relative')).toBe(false);
  });

  it('rejects ids starting with dot or hyphen', () => {
    expect(isValidBlobId('.hidden')).toBe(false);
    expect(isValidBlobId('-bad-start')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidBlobId('')).toBe(false);
  });

  it('rejects ids longer than 128 chars', () => {
    expect(isValidBlobId('a'.repeat(129))).toBe(false);
    expect(isValidBlobId('a'.repeat(128))).toBe(true);
  });

  it('rejects slashes', () => {
    expect(isValidBlobId('foo/bar')).toBe(false);
    expect(isValidBlobId('foo\\bar')).toBe(false);
  });
});

describe('isValidContentType', () => {
  it('blocks text/html', () => expect(isValidContentType('text/html')).toBe(false));
  it('blocks application/javascript', () => expect(isValidContentType('application/javascript')).toBe(false));
  it('blocks text/javascript', () => expect(isValidContentType('text/javascript')).toBe(false));
  it('blocks image/svg+xml', () => expect(isValidContentType('image/svg+xml')).toBe(false));
  it('blocks application/xhtml+xml', () => expect(isValidContentType('application/xhtml+xml')).toBe(false));

  it('allows text/plain', () => expect(isValidContentType('text/plain')).toBe(true));
  it('allows application/octet-stream', () => expect(isValidContentType('application/octet-stream')).toBe(true));
  it('allows application/json', () => expect(isValidContentType('application/json')).toBe(true));
  it('allows image/png', () => expect(isValidContentType('image/png')).toBe(true));

  it('ignores charset parameters when checking', () => {
    expect(isValidContentType('text/html; charset=utf-8')).toBe(false);
    expect(isValidContentType('text/plain; charset=utf-8')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isValidContentType('Text/HTML')).toBe(false);
    expect(isValidContentType('APPLICATION/JAVASCRIPT')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('strips double quotes', () => {
    expect(sanitizeFilename('file"name.txt')).toBe('filename.txt');
  });

  it('strips newlines', () => {
    expect(sanitizeFilename('evil\ninjected.txt')).toBe('evilinjected.txt');
  });

  it('strips carriage returns', () => {
    expect(sanitizeFilename('evil\rinjected.txt')).toBe('evilinjected.txt');
  });

  it('strips null bytes', () => {
    expect(sanitizeFilename('file\0name.txt')).toBe('filename.txt');
  });

  it('strips backslashes', () => {
    expect(sanitizeFilename('path\\file.txt')).toBe('pathfile.txt');
  });

  it('leaves safe filenames unchanged', () => {
    expect(sanitizeFilename('my-document.pdf')).toBe('my-document.pdf');
    expect(sanitizeFilename('file name with spaces.txt')).toBe('file name with spaces.txt');
  });
});
