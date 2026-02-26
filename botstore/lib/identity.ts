/**
 * Manages botstore's own identity with botdentity.
 * On first use, registers as a new identity and persists credentials to data/identity.json.
 */
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const IDENTITY_FILE = path.join(DATA_DIR, 'identity.json');

export interface StoredIdentity {
  id: string;
  name: string;
  public_key: string;
  private_key: string;
  created_at: string;
}

let _identity: StoredIdentity | null = null;

function botdentityUrl(): string {
  return process.env.BOTDENTITY_URL ?? 'http://localhost:3001';
}

export async function getIdentity(): Promise<StoredIdentity> {
  if (_identity) return _identity;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(IDENTITY_FILE)) {
    _identity = JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf-8')) as StoredIdentity;
    return _identity;
  }

  // Register with botdentity
  const res = await fetch(`${botdentityUrl()}/api/identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'botstore' }),
  });

  if (!res.ok) {
    throw new Error(`Failed to register identity with botdentity: ${await res.text()}`);
  }

  const data = (await res.json()) as StoredIdentity;
  fs.writeFileSync(IDENTITY_FILE, JSON.stringify(data, null, 2));
  _identity = data;
  return _identity;
}
