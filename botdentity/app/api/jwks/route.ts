import { NextResponse } from 'next/server';
import { getOrCreateSigningKey } from '@/lib/crypto';
import db from '@/lib/db';

export function GET() {
  const { kid, publicKey } = getOrCreateSigningKey(db);
  const jwk = publicKey.export({ format: 'jwk' }) as {
    kty: string;
    crv: string;
    x: string;
    y: string;
  };
  return NextResponse.json({
    keys: [{ ...jwk, kid, use: 'sig', alg: 'ES256' }],
  });
}
