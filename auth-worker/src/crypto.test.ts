import { describe, expect, it } from 'vitest';
import { appJwt, base64UrlDecode, base64UrlEncode, pemToPkcs8, signSession, verifySession } from './crypto';

describe('base64url', () => {
  it('round-trips bytes without padding or + and /', () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, index) => (index * 37) % 256);
    const text = base64UrlEncode(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect([...base64UrlDecode(text)]).toEqual([...bytes]);
  });
});

describe('sessions', () => {
  it('accepts its own unexpired tokens', async () => {
    const token = await signSession({ login: 'collab', exp: 2_000 }, 'secret');
    expect(await verifySession(token, 'secret', 1_000)).toEqual({ login: 'collab', exp: 2_000 });
  });

  it('rejects expired, tampered or foreign tokens', async () => {
    const token = await signSession({ login: 'collab', exp: 2_000 }, 'secret');
    expect(await verifySession(token, 'secret', 2_000)).toBeNull();
    expect(await verifySession(token, 'other-secret', 1_000)).toBeNull();
    const forged = `${base64UrlEncode(new TextEncoder().encode(JSON.stringify({ login: 'owner', exp: 9e15 })))}.${token.split('.')[1]}`;
    expect(await verifySession(forged, 'secret', 1_000)).toBeNull();
    expect(await verifySession('not-a-token', 'secret', 1_000)).toBeNull();
    expect(await verifySession(`${token}.extra`, 'secret', 1_000)).toBeNull();
  });
});

// Reads one DER element: its tag, where its contents start and how long they are.
function readDer(bytes: Uint8Array, at: number): { tag: number; start: number; length: number } {
  const tag = bytes[at];
  let length = bytes[at + 1];
  let start = at + 2;
  if (length & 0x80) {
    const count = length & 0x7f;
    length = 0;
    for (let index = 0; index < count; index += 1) length = length * 256 + bytes[start + index];
    start += count;
  }
  return { tag, start, length };
}

/** A PEM block of the given label. */
const pem = (label: string, der: Uint8Array): string =>
  `-----BEGIN ${label}-----\n${(btoa(String.fromCharCode(...der)).match(/.{1,64}/g) ?? []).join('\n')}\n-----END ${label}-----\n`;

/** A fresh RSA key as GitHub would hand it out (PKCS#1), as PKCS#8, and its public key. */
async function rsaKeys() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  // PKCS#8 = SEQUENCE { version, algorithm, OCTET STRING { PKCS#1 } }: take the OCTET STRING's contents.
  const outer = readDer(pkcs8, 0);
  const version = readDer(pkcs8, outer.start);
  const algorithm = readDer(pkcs8, version.start + version.length);
  const key = readDer(pkcs8, algorithm.start + algorithm.length);
  const pkcs1 = pkcs8.slice(key.start, key.start + key.length);
  return { pkcs1: pem('RSA PRIVATE KEY', pkcs1), pkcs8: pem('PRIVATE KEY', pkcs8), publicKey: pair.publicKey };
}

describe('GitHub App JWT', () => {
  it('wraps the PKCS#1 keys GitHub issues and signs a verifiable RS256 token', async () => {
    const keys = await rsaKeys();
    const token = await appJwt('Iv23.client', keys.pkcs1, 1_700_000_000_000);
    const [header, payload, signature] = token.split('.');
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(header)))).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)))).toEqual({
      iat: 1_700_000_000 - 60,
      exp: 1_700_000_000 + 540,
      iss: 'Iv23.client',
    });
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      keys.publicKey,
      base64UrlDecode(signature),
      new TextEncoder().encode(`${header}.${payload}`),
    );
    expect(valid).toBe(true);
  });

  it('accepts keys pasted with literal \\n and PKCS#8 keys as they are', async () => {
    const keys = await rsaKeys();
    expect(pemToPkcs8(keys.pkcs1.replace(/\n/g, '\\n'))).toEqual(pemToPkcs8(keys.pkcs1));
    expect(pemToPkcs8(keys.pkcs1)).toEqual(pemToPkcs8(keys.pkcs8));
    await expect(appJwt('Iv23.client', keys.pkcs8)).resolves.toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(() => pemToPkcs8('-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----')).toThrow();
  });
});
