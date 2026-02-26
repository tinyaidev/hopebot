// Blob ID: must start with alphanumeric, only alphanumeric/hyphen/underscore, max 128 chars.
// Blocks path traversal sequences like ../, ./, leading dots/hyphens.
const SAFE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function isValidBlobId(id: string): boolean {
  return SAFE_ID_RE.test(id);
}

// Content types that browsers render as active content — must not be served directly.
const BLOCKED_CONTENT_TYPES = new Set([
  'text/html',
  'text/xml',
  'application/xml',
  'application/xhtml+xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'image/svg+xml',
]);

export function isValidContentType(contentType: string): boolean {
  const base = contentType.split(';')[0].trim().toLowerCase();
  return !BLOCKED_CONTENT_TYPES.has(base);
}

// Strip characters that can break or inject into Content-Disposition header.
export function sanitizeFilename(filename: string): string {
  return filename.replace(/["\r\n\0\\]/g, '');
}
