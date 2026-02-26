import crypto from 'crypto';

const BD = 'http://localhost:3001';
const BS = 'http://localhost:3002';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sign(identityId, privateKeyB64, timestamp) {
  const privKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyB64, 'base64'),
    type: 'pkcs8',
    format: 'der',
  });
  return crypto.sign(null, Buffer.from(`${identityId}:${timestamp}`), privKey).toString('base64');
}

async function requestJwt(identityId, privateKeyB64, opts = {}) {
  const ts = Date.now();
  const sig = sign(identityId, privateKeyB64, ts);
  return fetch(`${BD}/api/jwt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity_id: identityId, signature: sig, timestamp: ts, ...opts }),
  });
}

function decodeClaims(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

let passed = 0, failed = 0;
const failures = [];

function assert(desc, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    const msg = detail ? `${desc} — ${detail}` : desc;
    console.log(`  ✗ ${msg}`);
    failures.push(msg);
    failed++;
  }
}

function assertEq(desc, a, b) {
  assert(desc, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function section(name) {
  const pad = '─'.repeat(Math.max(0, 50 - name.length - 4));
  console.log(`\n── ${name} ${pad}`);
}

const SEP = '━'.repeat(50);

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${SEP}\n  botdentity + botstore E2E\n${SEP}`);

// Shared state
let identity1, token06, token07, jti06;

// ─────────────────────────────────────────────────────────────────────────────
section('Identity API');

// T01
{
  const res = await fetch(`${BD}/api/identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'test-bot-1' }),
  });
  const body = await res.json();
  assert(
    'T01 POST /api/identity → id/name/keys/credits=0',
    res.status === 200 && !!body.id && !!body.name && !!body.public_key && !!body.private_key && body.credits === 0,
    `status=${res.status}`,
  );
  identity1 = body;
}

// T02
{
  const res = await fetch(`${BD}/api/identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assertEq('T02 POST /api/identity (no name) → 400', res.status, 400);
}

// T03
{
  const res = await fetch(`${BD}/api/identity/${identity1.id}`);
  const body = await res.json();
  assert(
    'T03 GET /api/identity/:id → id/name/public_key/credits, no private_key',
    res.status === 200 && !!body.id && !!body.name && !!body.public_key &&
      body.credits !== undefined && !('private_key' in body),
    `status=${res.status} has_private_key=${'private_key' in body}`,
  );
}

// T04
{
  const res = await fetch(`${BD}/api/identity/nonexistent-id`);
  assertEq('T04 GET /api/identity/nonexistent-id → 404', res.status, 404);
}

// ─────────────────────────────────────────────────────────────────────────────
section('JWKS');

// T05
{
  const res = await fetch(`${BD}/api/jwks`);
  const body = await res.json();
  const key = body.keys?.[0];
  assert(
    'T05 GET /api/jwks → EC/P-256/ES256/sig key with kid/x/y',
    res.status === 200 && key?.kty === 'EC' && key?.crv === 'P-256' &&
      key?.alg === 'ES256' && key?.use === 'sig' && !!key?.kid && !!key?.x && !!key?.y,
    `kty=${key?.kty} crv=${key?.crv} alg=${key?.alg} use=${key?.use}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
section('JWT API');

// T06
{
  const res = await requestJwt(identity1.id, identity1.private_key);
  const body = await res.json();
  assert(
    'T06 POST /api/jwt (no audience) → token + expires_at',
    res.status === 200 && !!body.token && !!body.expires_at,
    `status=${res.status}`,
  );
  token06 = body.token;
  if (token06) jti06 = decodeClaims(token06).jti;
}

// T07: POST with aud=botstore + verify on botdentity
{
  const res = await requestJwt(identity1.id, identity1.private_key, { audience: 'botstore' });
  const body = await res.json();
  token07 = body.token;
  let verifyValid = false;
  if (token07) {
    const vRes = await fetch(`${BD}/api/jwt/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token07, audience: 'botstore' }),
    });
    const vBody = await vRes.json();
    verifyValid = vRes.status === 200 && vBody.valid === true;
  }
  assert(
    'T07 POST /api/jwt (aud=botstore) → 200; verify with aud=botstore → valid=true',
    res.status === 200 && !!token07 && verifyValid,
    `status=${res.status} verifyValid=${verifyValid}`,
  );
}

// T08: timestamp 90s in the past
{
  const ts = Date.now() - 90_000;
  const sig = sign(identity1.id, identity1.private_key, ts);
  const res = await fetch(`${BD}/api/jwt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity_id: identity1.id, signature: sig, timestamp: ts }),
  });
  assertEq('T08 POST /api/jwt (timestamp 90s old) → 401', res.status, 401);
}

// T09: wrong signature
{
  const ts = Date.now();
  const res = await fetch(`${BD}/api/jwt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity_id: identity1.id, signature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', timestamp: ts }),
  });
  assertEq('T09 POST /api/jwt (wrong signature) → 401', res.status, 401);
}

// T10: invalid validity
{
  const res = await requestJwt(identity1.id, identity1.private_key, { validity: '999d' });
  assertEq('T10 POST /api/jwt (validity="999d") → 400', res.status, 400);
}

// T11: claims include exp
{
  const res = await requestJwt(identity1.id, identity1.private_key, { claims: { exp: 9999999999 } });
  assertEq('T11 POST /api/jwt (claims includes exp) → 400', res.status, 400);
}

// T12: custom claims + decode to verify
{
  const res = await requestJwt(identity1.id, identity1.private_key, { claims: { role: 'admin' } });
  const body = await res.json();
  let claimsOk = false;
  if (res.status === 200 && body.token) {
    const claims = decodeClaims(body.token);
    claimsOk = claims.role === 'admin' && claims.sub === identity1.id;
  }
  assert(
    'T12 POST /api/jwt (claims={role:admin}) → 200; role=admin, sub=identityId',
    res.status === 200 && !!body.token && claimsOk,
    `status=${res.status} claimsOk=${claimsOk}`,
  );
}

// T13: verify valid token from T06
{
  const res = await fetch(`${BD}/api/jwt/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token06 }),
  });
  const body = await res.json();
  assert(
    'T13 POST /api/jwt/verify (valid token) → valid=true + sub/iss/jti',
    res.status === 200 && body.valid === true && !!body.claims?.sub && !!body.claims?.iss && !!body.claims?.jti,
    `status=${res.status} valid=${body.valid}`,
  );
}

// T14: garbage token
{
  const res = await fetch(`${BD}/api/jwt/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'garbage.token.value' }),
  });
  const body = await res.json();
  assert(
    'T14 POST /api/jwt/verify (garbage token) → 401, valid=false',
    res.status === 401 && body.valid === false,
    `status=${res.status} valid=${body.valid}`,
  );
}

// T15: revoke token from T06
{
  const res = await fetch(`${BD}/api/jwt/${jti06}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token06}` },
  });
  const body = await res.json();
  assert(
    'T15 DELETE /api/jwt/:jti → revoked=true',
    res.status === 200 && body.revoked === true,
    `status=${res.status} revoked=${body.revoked}`,
  );
}

// T16: verify revoked token
{
  const res = await fetch(`${BD}/api/jwt/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token06 }),
  });
  const body = await res.json();
  assert(
    'T16 POST /api/jwt/verify (revoked token) → 401, valid=false',
    res.status === 401 && body.valid === false,
    `status=${res.status} valid=${body.valid}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
section('Credits API');

// T17
{
  const ts = Date.now();
  const sig = sign(identity1.id, identity1.private_key, ts);
  const res = await fetch(`${BD}/api/credits/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity_id: identity1.id, signature: sig, timestamp: ts, slug: 'test-purchase' }),
  });
  const body = await res.json();
  assert(
    'T17 POST /api/credits/buy → credits_added=1000, credits=1000',
    res.status === 200 && body.credits_added === 1000 && body.credits === 1000,
    `status=${res.status} credits_added=${body.credits_added} credits=${body.credits}`,
  );
}

// T18: credits reflected in GET identity
{
  const res = await fetch(`${BD}/api/identity/${identity1.id}`);
  const body = await res.json();
  assertEq('T18 GET /api/identity/:id → credits=1000', body.credits, 1000);
}

// T19: expired timestamp
{
  const ts = Date.now() - 90_000;
  const sig = sign(identity1.id, identity1.private_key, ts);
  const res = await fetch(`${BD}/api/credits/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity_id: identity1.id, signature: sig, timestamp: ts, slug: 'test-old' }),
  });
  assertEq('T19 POST /api/credits/buy (90s old timestamp) → 401', res.status, 401);
}

// ─────────────────────────────────────────────────────────────────────────────
section('Blob API (botstore)');

// T20: no auth
{
  const res = await fetch(`${BS}/api/blobs`);
  assertEq('T20 GET /api/blobs (no auth) → 401', res.status, 401);
}

// T21: JWT without aud:botstore → 401 (botstore requires aud=botstore)
{
  const res = await requestJwt(identity1.id, identity1.private_key);
  const { token: tokenNoAud } = await res.json();
  const bRes = await fetch(`${BS}/api/blobs`, {
    headers: { Authorization: `Bearer ${tokenNoAud}` },
  });
  assertEq('T21 GET /api/blobs (JWT without aud:botstore) → 401', bRes.status, 401);
}

// T22: create blob
{
  const res = await fetch(`${BS}/api/blobs/test-blob-alpha`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token07}`, 'Content-Type': 'text/plain' },
    body: 'hello e2e',
  });
  const body = await res.json();
  assert(
    'T22 PUT /api/blobs/test-blob-alpha → 200, action=created',
    res.status === 200 && body.action === 'created',
    `status=${res.status} action=${body.action}`,
  );
}

// T23: list blobs
{
  const res = await fetch(`${BS}/api/blobs`, {
    headers: { Authorization: `Bearer ${token07}` },
  });
  const body = await res.json();
  assert(
    'T23 GET /api/blobs → contains test-blob-alpha',
    res.status === 200 && Array.isArray(body.blobs) && body.blobs.some((b) => b.id === 'test-blob-alpha'),
    `status=${res.status} blobIds=${body.blobs?.map((b) => b.id).join(',')}`,
  );
}

// T24: get blob content
{
  const res = await fetch(`${BS}/api/blobs/test-blob-alpha`, {
    headers: { Authorization: `Bearer ${token07}` },
  });
  const text = await res.text();
  assert(
    'T24 GET /api/blobs/test-blob-alpha → body="hello e2e", Content-Type=text/plain',
    res.status === 200 && text === 'hello e2e' && (res.headers.get('content-type') ?? '').includes('text/plain'),
    `status=${res.status} body=${JSON.stringify(text)} ct=${res.headers.get('content-type')}`,
  );
}

// T25: update blob
{
  const res = await fetch(`${BS}/api/blobs/test-blob-alpha`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token07}`, 'Content-Type': 'text/plain' },
    body: 'updated content',
  });
  const body = await res.json();
  assert(
    'T25 PUT /api/blobs/test-blob-alpha (update) → action=updated',
    res.status === 200 && body.action === 'updated',
    `status=${res.status} action=${body.action}`,
  );
}

// T26: delete blob
{
  const res = await fetch(`${BS}/api/blobs/test-blob-alpha`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token07}` },
  });
  const body = await res.json();
  assert(
    'T26 DELETE /api/blobs/test-blob-alpha → deleted=test-blob-alpha',
    res.status === 200 && body.deleted === 'test-blob-alpha',
    `status=${res.status} deleted=${body.deleted}`,
  );
}

// T27: get deleted blob
{
  const res = await fetch(`${BS}/api/blobs/test-blob-alpha`, {
    headers: { Authorization: `Bearer ${token07}` },
  });
  assertEq('T27 GET /api/blobs/test-blob-alpha (after delete) → 404', res.status, 404);
}

// T28: path traversal in blob ID (URL-encoded so it reaches the route handler)
{
  const res = await fetch(`${BS}/api/blobs/..%2Fetc%2Fpasswd`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token07}`, 'Content-Type': 'text/plain' },
    body: 'bad',
  });
  assertEq('T28 PUT /api/blobs/../etc/passwd (path traversal) → 400', res.status, 400);
}

// T29: blocked content type
{
  const res = await fetch(`${BS}/api/blobs/test-blob-beta`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token07}`, 'Content-Type': 'text/html' },
    body: '<h1>bad</h1>',
  });
  assertEq('T29 PUT /api/blobs/test-blob-beta (Content-Type: text/html) → 400', res.status, 400);
}

// T30: identity2 tries to overwrite identity1's blob → 403
{
  // Create identity2
  const id2Res = await fetch(`${BD}/api/identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'test-bot-2' }),
  });
  const identity2 = await id2Res.json();

  // identity1 creates test-blob-gamma
  await fetch(`${BS}/api/blobs/test-blob-gamma`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token07}`, 'Content-Type': 'text/plain' },
    body: 'identity1 owns this',
  });

  // identity2 gets a botstore JWT
  const tok2Res = await requestJwt(identity2.id, identity2.private_key, { audience: 'botstore' });
  const { token: token2 } = await tok2Res.json();

  // identity2 tries to overwrite
  const res = await fetch(`${BS}/api/blobs/test-blob-gamma`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token2}`, 'Content-Type': 'text/plain' },
    body: 'identity2 override attempt',
  });
  assertEq('T30 PUT /api/blobs/test-blob-gamma by identity2 (identity1 owns) → 403', res.status, 403);
}

// T31: nonexistent blob
{
  const res = await fetch(`${BS}/api/blobs/test-blob-nonexistent`, {
    headers: { Authorization: `Bearer ${token07}` },
  });
  assertEq('T31 GET /api/blobs/test-blob-nonexistent → 404', res.status, 404);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${SEP}`);
if (failures.length > 0) {
  console.log(`── FAILURES ${'─'.repeat(39)}`);
  for (const f of failures) console.log(`  ✗ ${f}`);
}
console.log(`${SEP}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${SEP}\n`);

if (failed > 0) process.exit(1);
