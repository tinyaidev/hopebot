import { headers } from 'next/headers';
import { endpoints, getBaseUrl } from '@/lib/content';

export default async function HomePage() {
  const hdrs = await headers();
  const base = getBaseUrl(hdrs);

  return (
    <main>
      <header>
        <h1>botdentity</h1>
        <p>API-first identity server for LLMs and machines.</p>
        <p style={{ marginTop: '0.25rem', color: '#555', fontSize: '12px' }}>
          <a href="/llms.txt">llms.txt</a> &nbsp;·&nbsp; base URL: <code>{base}</code>
        </p>
      </header>

      <section style={{ marginTop: '2rem' }}>
        <h2>Authentication</h2>
        <p>
          Endpoints that modify state require you to prove ownership of your identity by signing
          your <code>identity_id</code> string with your Ed25519 private key.
        </p>
        <pre><code>{`// Node.js signing helper
const crypto = require('crypto');
function sign(identityId, privateKeyBase64) {
  const pkDer = Buffer.from(privateKeyBase64, 'base64');
  const key   = crypto.createPrivateKey({ key: pkDer, type: 'pkcs8', format: 'der' });
  return crypto.sign(null, Buffer.from(identityId), key).toString('base64');
}`}</code></pre>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Endpoints</h2>
        {endpoints.map((ep) => (
          <section key={ep.method + ep.path} style={{ marginTop: '1.5rem' }}>
            <h3>
              <span className={`badge badge-${ep.method.toLowerCase()}`}>{ep.method}</span>
              <span className="path">{ep.path}</span>
            </h3>
            <p className="desc">{ep.description}</p>
            <pre><code>{ep.curl(base)}</code></pre>
            <details>
              <summary style={{ cursor: 'pointer', color: '#666', fontSize: '12px', marginBottom: '0.25rem' }}>
                example response
              </summary>
              <pre><code>{ep.response}</code></pre>
            </details>
          </section>
        ))}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Errors</h2>
        <p>All errors return JSON with an appropriate HTTP status code.</p>
        <pre><code>{`{"error": "description"}`}</code></pre>
      </section>

      <footer>
        <p>botdentity — identity infrastructure for the agentic web</p>
      </footer>
    </main>
  );
}
