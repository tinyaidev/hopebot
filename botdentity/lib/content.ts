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
    description:
      'Create a new identity with a name. Returns an Ed25519 keypair. The private_key is shown once — store it.',
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
    method: 'GET',
    path: '/api/jwks',
    description:
      'Returns the public JSON Web Key Set (JWKS) used to verify JWTs issued by this server. Use this to verify tokens locally without calling /api/jwt/verify.',
    curl: (base) => `curl -s ${base}/api/jwks`,
    response: `{
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "alg": "ES256",
      "use": "sig",
      "kid": "a1b2c3d4-...",
      "x": "<base64url>",
      "y": "<base64url>"
    }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/api/jwt',
    description:
      'Create a signed JWT (ES256). Authenticate by signing the string `identity_id:timestamp` with your Ed25519 private key. timestamp is Unix milliseconds (Date.now()) and must be within 60 seconds of server time. validity options: 1h, 24h (default), 7d, 30d. Optional audience scopes the token to a specific service.',
    curl: (base) => `# Sign identity_id:timestamp with your private key (Node.js):
node -e "
  const crypto = require('crypto');
  const id = 'YOUR_IDENTITY_ID';
  const ts = Date.now();
  const key = crypto.createPrivateKey({
    key: Buffer.from('YOUR_PRIVATE_KEY', 'base64'), type: 'pkcs8', format: 'der'
  });
  const sig = crypto.sign(null, Buffer.from(id + ':' + ts), key).toString('base64');
  console.log('ts=' + ts + '  sig=' + sig);
"

# Then create the JWT:
curl -s -X POST ${base}/api/jwt \\
  -H "Content-Type: application/json" \\
  -d '{
    "identity_id": "YOUR_IDENTITY_ID",
    "signature": "BASE64_SIGNATURE",
    "timestamp": 1740268800000,
    "validity": "24h",
    "audience": "botstore"
  }'`,
    response: `{
  "token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-02-24T00:00:00.000Z"
}`,
  },
  {
    method: 'POST',
    path: '/api/jwt/verify',
    description:
      'Verify a JWT issued by this server. Returns decoded claims if valid. Optionally check audience.',
    curl: (base) => `curl -s -X POST ${base}/api/jwt/verify \\
  -H "Content-Type: application/json" \\
  -d '{"token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...", "audience": "botstore"}'`,
    response: `{
  "valid": true,
  "claims": {
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "iss": "botdentity",
    "aud": "botstore",
    "jti": "a1b2c3d4-...",
    "iat": 1740268800,
    "exp": 1740355200
  }
}`,
  },
  {
    method: 'DELETE',
    path: '/api/jwt/:jti',
    description:
      'Revoke a JWT by its jti claim. Pass the token itself as Bearer auth — only the token owner can revoke it, and the jti in the URL must match the token\'s own jti claim.',
    curl: (base) => `curl -s -X DELETE ${base}/api/jwt/YOUR_JTI \\
  -H "Authorization: Bearer YOUR_TOKEN"`,
    response: `{"revoked": true}`,
  },
  {
    method: 'POST',
    path: '/api/credits/buy',
    description:
      'Purchase credits for an identity. Requires identity signature over identity_id:timestamp. Stub — currently grants 1000 credits unconditionally.',
    curl: (base) => `curl -s -X POST ${base}/api/credits/buy \\
  -H "Content-Type: application/json" \\
  -d '{
    "identity_id": "YOUR_IDENTITY_ID",
    "signature": "BASE64_SIGNATURE",
    "timestamp": 1740268800000,
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
    'Endpoints that modify state require you to prove ownership of your identity by signing',
    'the string `identity_id:timestamp` with your Ed25519 private key:',
    '',
    '```js',
    'const crypto = require(\'crypto\');',
    'const ts = Date.now(); // Unix milliseconds — must be within 60s of server time',
    'const message = Buffer.from(`${identity_id}:${ts}`);',
    'const key = crypto.createPrivateKey({ key: Buffer.from(private_key, \'base64\'), type: \'pkcs8\', format: \'der\' });',
    'const signature = crypto.sign(null, message, key).toString(\'base64\');',
    '// Pass identity_id, signature, and timestamp in the request body',
    '```',
    '',
    'JWTs are ES256-signed and can be verified locally using the JWKS at /api/jwks.',
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
