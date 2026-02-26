// Shared content for landing page and llms.txt
export function getBaseUrl(hdrs?: { get(name: string): string | null }): string {
  if (hdrs) {
    const host = hdrs.get('host') ?? 'localhost:3002';
    const proto = hdrs.get('x-forwarded-proto') ?? 'http';
    return `${proto}://${host}`;
  }
  return process.env.BASE_URL ?? 'http://localhost:3002';
}

export function getBotdentityUrl(): string {
  return process.env.BOTDENTITY_URL ?? 'http://localhost:3001';
}

export interface Endpoint {
  method: string;
  path: string;
  description: string;
  curl: (base: string) => string;
  response: string;
}

export const endpoints: Endpoint[] = [
  {
    method: 'PUT',
    path: '/api/blobs/:id',
    description:
      'Upload or update a blob. The id is client-provided. Content-Type determines MIME type. Optional X-Filename header sets the filename. Creates a transaction record on update. Blocked types: text/html, text/xml, application/javascript, image/svg+xml and similar active-content types.',
    curl: (b) => `# Upload text
curl -s -X PUT ${b}/api/blobs/my-doc \\
  -H "Authorization: Bearer YOUR_JWT" \\
  -H "Content-Type: text/plain" \\
  -H "X-Filename: readme.txt" \\
  --data-binary "Hello, world!"

# Upload binary file
curl -s -X PUT ${b}/api/blobs/my-image \\
  -H "Authorization: Bearer YOUR_JWT" \\
  -H "Content-Type: image/png" \\
  -H "X-Filename: photo.png" \\
  --data-binary @photo.png`,
    response: `{
  "id": "my-doc",
  "identity_id": "550e8400-...",
  "filename": "readme.txt",
  "content_type": "text/plain",
  "size": 13,
  "created_at": "2026-02-23T00:00:00.000Z",
  "updated_at": "2026-02-23T00:00:00.000Z",
  "last_transaction_at": null,
  "action": "created"
}`,
  },
  {
    method: 'GET',
    path: '/api/blobs/:id',
    description: 'Download a blob by id. Returns raw bytes with original Content-Type.',
    curl: (b) => `curl -s -o output.txt ${b}/api/blobs/my-doc \\
  -H "Authorization: Bearer YOUR_JWT"`,
    response: `<raw binary or text content>`,
  },
  {
    method: 'GET',
    path: '/api/blobs',
    description: 'List all blobs belonging to your identity (determined from the JWT sub claim).',
    curl: (b) => `curl -s ${b}/api/blobs \\
  -H "Authorization: Bearer YOUR_JWT"`,
    response: `{
  "blobs": [
    {
      "id": "my-doc",
      "identity_id": "550e8400-...",
      "filename": "readme.txt",
      "content_type": "text/plain",
      "size": 13,
      "created_at": "2026-02-23T00:00:00.000Z",
      "updated_at": "2026-02-23T00:10:00.000Z",
      "last_transaction_at": "2026-02-23T00:10:00.000Z"
    }
  ]
}`,
  },
  {
    method: 'DELETE',
    path: '/api/blobs/:id',
    description: 'Delete a blob. Only the owning identity may delete.',
    curl: (b) => `curl -s -X DELETE ${b}/api/blobs/my-doc \\
  -H "Authorization: Bearer YOUR_JWT"`,
    response: `{"deleted": "my-doc"}`,
  },
];

export function toMarkdown(base: string, botdentity: string): string {
  const lines: string[] = [
    '# botstore',
    '',
    'Blob storage for LLM identities. Text and binary. All endpoints require a JWT issued by botdentity.',
    '',
    `Base URL: ${base}`,
    `Identity server: ${botdentity}`,
    '',
    '---',
    '',
    '## Authentication',
    '',
    'All endpoints require `Authorization: Bearer <jwt>`. The JWT must be issued by botdentity',
    'with `audience: "botstore"` — tokens without this audience claim are rejected.',
    '',
    '```bash',
    '# 1. Create an identity on botdentity:',
    `curl -s -X POST ${botdentity}/api/identity \\`,
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"name":"my-bot"}\'',
    '',
    '# 2. Sign identity_id:timestamp and get a JWT (timestamp = Unix ms, must be within 60s):',
    'node -e "',
    '  const crypto = require(\'crypto\');',
    '  const id = \'YOUR_IDENTITY_ID\';',
    '  const ts = Date.now();',
    '  const key = crypto.createPrivateKey({',
    '    key: Buffer.from(\'YOUR_PRIVATE_KEY\', \'base64\'), type: \'pkcs8\', format: \'der\'',
    '  });',
    '  const sig = crypto.sign(null, Buffer.from(id + \':\' + ts), key).toString(\'base64\');',
    '  console.log(\'ts=\' + ts + \'  sig=\' + sig);',
    '"',
    '',
    `curl -s -X POST ${botdentity}/api/jwt \\`,
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"identity_id":"YOUR_ID","signature":"SIG","timestamp":TS,"validity":"24h","audience":"botstore"}\'',
    '```',
    '',
    '---',
    '',
    '## Endpoints',
    '',
  ];

  for (const ep of endpoints) {
    lines.push(`### ${ep.method} ${ep.path}`);
    lines.push('');
    lines.push(ep.description);
    lines.push('');
    lines.push('```bash');
    lines.push(ep.curl(base));
    lines.push('```');
    lines.push('');
    lines.push('**Example response:**');
    lines.push('');
    lines.push('```json');
    lines.push(ep.response);
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('## Error format');
  lines.push('');
  lines.push('All errors return JSON: `{"error": "description"}` with an appropriate HTTP status code.');
  lines.push('');
  lines.push('## Transaction records');
  lines.push('');
  lines.push(
    'Every time a blob is updated, a transaction record captures the previous size and',
    'how long the blob existed in that state (in seconds). This forms the basis for future usage-based billing.',
  );
  lines.push('');

  return lines.join('\n');
}
