/** Signing for the worker: collaborator sessions (HMAC-SHA256) and GitHub App JWTs (RS256). */

const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0));
}

/** Who a collaborator session belongs to, and until when (epoch milliseconds). */
export interface SessionClaims {
  login: string;
  exp: number;
}

const hmacKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function signSession(claims: SessionClaims, secret: string): Promise<string> {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload)));
  return `${payload}.${base64UrlEncode(signature)}`;
}

/** The claims of a valid, unexpired session token; null for anything else. */
export async function verifySession(token: string, secret: string, now = Date.now()): Promise<SessionClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), base64UrlDecode(parts[1]), encoder.encode(parts[0]));
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as Partial<SessionClaims>;
    if (typeof claims.login !== 'string' || typeof claims.exp !== 'number' || claims.exp <= now) return null;
    return { login: claims.login, exp: claims.exp };
  } catch {
    return null;
  }
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function derLength(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.of(length);
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest % 256);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

const der = (tag: number, ...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const body = concat(parts);
  return concat([Uint8Array.of(tag), derLength(body.length), body]);
};

// AlgorithmIdentifier { rsaEncryption, NULL }.
const RSA_ENCRYPTION = Uint8Array.of(0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00);

/**
 * DER bytes of a PKCS#8 private key. GitHub hands out PKCS#1 keys ("BEGIN RSA PRIVATE KEY"), which WebCrypto
 * cannot import, so those are wrapped in a PKCS#8 envelope. A secret pasted with literal "\n" works too.
 */
export function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const text = pem.replace(/\\n/g, '\n');
  const body = base64UrlDecode(
    text
      .replace(/-----(BEGIN|END)[^-]+-----/g, '')
      .replace(/\s+/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  );
  if (/BEGIN PRIVATE KEY/.test(text)) return body;
  if (/BEGIN RSA PRIVATE KEY/.test(text)) return der(0x30, Uint8Array.of(0x02, 0x01, 0x00), RSA_ENCRYPTION, der(0x04, body));
  throw new Error('Unsupported private key format');
}

/** A JWT that authenticates as the GitHub App (valid for 9 minutes; GitHub allows at most 10). */
export async function appJwt(clientId: string, pem: string, now = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const seconds = Math.floor(now / 1000);
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  // Issued a minute early to absorb clock drift between Cloudflare and GitHub.
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({ iat: seconds - 60, exp: seconds + 540, iss: clientId })));
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${header}.${payload}`)));
  return `${header}.${payload}.${base64UrlEncode(signature)}`;
}
