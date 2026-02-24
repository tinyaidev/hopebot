import { headers } from 'next/headers';

function getBase(hdrs: Awaited<ReturnType<typeof headers>>): string {
  const host = hdrs.get('host') ?? 'localhost:3002';
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

interface Ep {
  method: string;
  path: string;
  description: string;
  curl: (base: string) => string;
  response: string;
}

export default async function HomePage() {
  const hdrs = await headers();
  const base = getBase(hdrs);
  const botdentity = process.env.BOTDENTITY_URL ?? 'http://localhost:3001';

  const eps: Ep[] = [
    {
      method: 'PUT',
      path: '/api/blobs/:id',
      description:
        'Upload or update a blob. The id is client-provided. Content-Type determines MIME type. Optional X-Filename header sets the filename. Creates a transaction record on update.',
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
      description: 'List all blobs belonging to your identity (determined from JWT).',
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

  return (
    <main>
      <header>
        <h1>botstore</h1>
        <p>Blob storage for LLM identities. Text and binary. All authenticated via JWT.</p>
        <p style={{ marginTop: '0.25rem', color: '#555', fontSize: '12px' }}>
          base URL: <code>{base}</code> &nbsp;·&nbsp;
          identity server: <code>{botdentity}</code>
        </p>
      </header>

      <section style={{ marginTop: '2rem' }}>
        <h2>Authentication</h2>
        <p>
          All endpoints require <code>Authorization: Bearer &lt;jwt&gt;</code>. Obtain a JWT from botdentity.
        </p>
        <pre><code>{`# 1. Create identity on botdentity
curl -X POST ${botdentity}/api/identity -H "Content-Type: application/json" -d '{"name":"my-bot"}'

# 2. Sign your identity_id and create a JWT
node -e "
  const crypto = require('crypto');
  const id  = 'YOUR_IDENTITY_ID';
  const key = crypto.createPrivateKey({ key: Buffer.from('YOUR_PRIVATE_KEY', 'base64'), type: 'pkcs8', format: 'der' });
  console.log(crypto.sign(null, Buffer.from(id), key).toString('base64'));
"

# 3. Exchange signature for JWT
curl -X POST ${botdentity}/api/jwt \\
  -H "Content-Type: application/json" \\
  -d '{"identity_id":"YOUR_ID","signature":"SIG","validity":"24h"}'`}</code></pre>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Endpoints</h2>
        {eps.map((ep) => (
          <section key={ep.method + ep.path} style={{ marginTop: '1.5rem' }}>
            <h3>
              <span className={`badge badge-${ep.method.toLowerCase()}`}>{ep.method}</span>
              {ep.path}
            </h3>
            <p style={{ color: '#999', fontSize: '13px', margin: '0.25rem 0 0.5rem' }}>
              {ep.description}
            </p>
            <pre><code>{ep.curl(base)}</code></pre>
            <details>
              <summary>example response</summary>
              <pre><code>{ep.response}</code></pre>
            </details>
          </section>
        ))}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Transaction Records</h2>
        <p>
          Every time a blob is updated, a transaction record is created capturing the previous
          size and how long the blob existed in that state (in seconds). This forms the basis for
          future usage-based billing.
        </p>
      </section>

      <footer>
        <p>botstore — blob storage for the agentic web</p>
      </footer>
    </main>
  );
}
