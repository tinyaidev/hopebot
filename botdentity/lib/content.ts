// Shared content for landing page and llms.txt
// BASE_URL is read at runtime so both dev and prod work
export function getBaseUrl(hdrs?: { get(name: string): string | null }): string {
  if (hdrs) {
    const host = hdrs.get('host') ?? 'localhost:3001';
    const proto = hdrs.get('x-forwarded-proto') ?? 'http';
    return `${proto}://${host}`;
  }
  return process.env.BASE_URL ?? 'http://localhost:3001';
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
    method: 'POST',
    path: '/api/identity',
    description: 'Create a new identity with a name. Returns an Ed25519 keypair. The private_key is shown once — store it.',
    curl: (base) => `curl -s -X POST ${base}/api/identity \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-bot"}'`,
    response: `{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-bot",
  "public_key": "<base64-spki-der>",
  "private_key": "<base64-pkcs8-der>",
  "credits": 0,
  "created_at": "2026-02-23T00:00:00.000Z",
  "note": "The private_key is shown only once and never stored. Save it securely."
}`,
  },
  {
    method: 'GET',
    path: '/api/identity/:id',
    description: 'Look up an identity by ID.',
    curl: (base) => `curl -s ${base}/api/identity/550e8400-e29b-41d4-a716-446655440000`,
    response: `{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-bot",
  "public_key": "<base64-spki-der>",
  "credits": 1000,
  "created_at": "2026-02-23T00:00:00.000Z"
}`,
  },
  {
    method: 'POST',
    path: '/api/jwt',
    description:
      'Create a signed JWT. Authenticate by signing your identity_id with your Ed25519 private key. validity options: 1h, 24h (default), 7d, 30d.',
    curl: (base) => `# Step 1 — sign your identity_id with your private key (Node.js):
node -e "
  const crypto = require('crypto');
  const id = 'YOUR_IDENTITY_ID';
  const pkDer = Buffer.from('YOUR_PRIVATE_KEY_BASE64', 'base64');
  const privateKey = crypto.createPrivateKey({ key: pkDer, type: 'pkcs8', format: 'der' });
  const sig = crypto.sign(null, Buffer.from(id), privateKey).toString('base64');
  console.log(sig);
"

# Step 2 — create the JWT:
curl -s -X POST ${base}/api/jwt \\
  -H "Content-Type: application/json" \\
  -d '{
    "identity_id": "YOUR_IDENTITY_ID",
    "signature": "BASE64_SIGNATURE",
    "claims": {"role": "agent"},
    "validity": "24h"
  }'`,
    response: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-02-24T00:00:00.000Z"
}`,
  },
  {
    method: 'POST',
    path: '/api/jwt/verify',
    description: 'Verify a JWT issued by this server. Returns decoded claims if valid.',
    curl: (base) => `curl -s -X POST ${base}/api/jwt/verify \\
  -H "Content-Type: application/json" \\
  -d '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'`,
    response: `{
  "valid": true,
  "claims": {
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "role": "agent",
    "iat": 1740268800,
    "exp": 1740355200,
    "iss": "botdentity"
  }
}`,
  },
  {
    method: 'POST',
    path: '/api/credits/buy',
    description:
      'Purchase credits for an identity. Provide a payment slug (stub — currently grants 1000 credits unconditionally). Requires identity signature.',
    curl: (base) => `curl -s -X POST ${base}/api/credits/buy \\
  -H "Content-Type: application/json" \\
  -d '{
    "identity_id": "YOUR_IDENTITY_ID",
    "signature": "BASE64_SIGNATURE",
    "slug": "promo-launch-2026"
  }'`,
    response: `{
  "transaction_id": "a1b2c3d4-...",
  "credits_added": 1000,
  "credits": 1000,
  "slug": "promo-launch-2026",
  "created_at": "2026-02-23T00:00:00.000Z"
}`,
  },
];

export function toMarkdown(base: string): string {
  const lines: string[] = [
    '# botdentity',
    '',
    'API-first identity server for LLMs and machines.',
    '',
    `Base URL: ${base}`,
    '',
    '---',
    '',
    '## Authentication',
    '',
    'Authenticated endpoints require you to sign your `identity_id` string with your',
    'Ed25519 private key using `crypto.sign(null, Buffer.from(identity_id), privateKey)`.',
    'Pass the resulting base64-encoded bytes as `signature`.',
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

  return lines.join('\n');
}
