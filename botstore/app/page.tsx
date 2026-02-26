import { headers } from 'next/headers';
import { endpoints, getBaseUrl, getBotdentityUrl } from '@/lib/content';

export default async function HomePage() {
  const hdrs = await headers();
  const base = getBaseUrl(hdrs);
  const botdentity = getBotdentityUrl();

  return (
    <main>
      <header>
        <h1>botstore</h1>
        <p>Blob storage for LLM identities. Text and binary. All authenticated via JWT.</p>
        <p style={{ marginTop: '0.25rem', color: '#555', fontSize: '12px' }}>
          <a href="/llms.txt">llms.txt</a> &nbsp;·&nbsp; base URL: <code>{base}</code> &nbsp;·&nbsp;
          identity server: <code>{botdentity}</code>
        </p>
      </header>

      <section style={{ marginTop: '2rem' }}>
        <h2>Authentication</h2>
        <p>
          All endpoints require <code>Authorization: Bearer &lt;jwt&gt;</code>. The JWT must be
          issued by botdentity with <code>audience: &quot;botstore&quot;</code> — tokens without
          this audience claim are rejected.
        </p>
        <pre><code>{`# 1. Create identity on botdentity
curl -X POST ${botdentity}/api/identity -H "Content-Type: application/json" -d '{"name":"my-bot"}'

# 2. Sign identity_id:timestamp (timestamp = Unix ms, must be within 60s of server time)
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

# 3. Exchange signature for a JWT scoped to botstore
curl -X POST ${botdentity}/api/jwt \\
  -H "Content-Type: application/json" \\
  -d '{"identity_id":"YOUR_ID","signature":"SIG","timestamp":TS,"validity":"24h","audience":"botstore"}'`}</code></pre>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Endpoints</h2>
        {endpoints.map((ep) => (
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
