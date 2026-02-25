import { describe, it, expect } from 'vitest';
import { generateKeypair, verifySignature } from '@/lib/crypto';
import crypto from 'crypto';

describe('generateKeypair', () => {
  it('returns base64 public and private keys', () => {
    const { publicKey, privateKey } = generateKeypair();
    expect(typeof publicKey).toBe('string');
    expect(typeof privateKey).toBe('string');
    expect(Buffer.from(publicKey, 'base64').length).toBeGreaterThan(0);
    expect(Buffer.from(privateKey, 'base64').length).toBeGreaterThan(0);
  });

  it('generates unique keys each time', () => {
    const a = generateKeypair();
    const b = generateKeypair();
    expect(a.publicKey).not.toBe(b.publicKey);
  });
});

describe('verifySignature', () => {
  it('returns true for valid signature', () => {
    const { publicKey, privateKey } = generateKeypair();
    const message = 'test-message';
    const privKey = crypto.createPrivateKey({
      key: Buffer.from(privateKey, 'base64'),
      type: 'pkcs8',
      format: 'der',
    });
    const sig = crypto.sign(null, Buffer.from(message), privKey).toString('base64');
    expect(verifySignature(message, sig, publicKey)).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const { publicKey } = generateKeypair();
    expect(verifySignature('message', 'badsig==', publicKey)).toBe(false);
  });

  it('returns false for mismatched message', () => {
    const { publicKey, privateKey } = generateKeypair();
    const privKey = crypto.createPrivateKey({
      key: Buffer.from(privateKey, 'base64'),
      type: 'pkcs8',
      format: 'der',
    });
    const sig = crypto.sign(null, Buffer.from('original'), privKey).toString('base64');
    expect(verifySignature('tampered', sig, publicKey)).toBe(false);
  });
});
