import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const APPLE_ISSUER = 'https://appleid.apple.com';
/** The mobile app's bundle ID: Apple issues its identity tokens for it. */
export const APPLE_AUDIENCE = 'org.youdescribe.mobile';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
// Apple rotates its signing keys, so an unknown key ID triggers a refetch, but at most this often.
const REFETCH_INTERVAL_MS = 60_000;

let keys = new Map<string, crypto.KeyObject>();
let fetchedAt = 0;

export function resetAppleKeys() {
  keys = new Map();
  fetchedAt = 0;
}

async function keyFor(kid: string): Promise<crypto.KeyObject> {
  if (!keys.has(kid) && Date.now() - fetchedAt >= REFETCH_INTERVAL_MS) {
    fetchedAt = Date.now();
    const { data } = await axios.get(APPLE_KEYS_URL, { timeout: 5000 });
    keys = new Map(data.keys.map((jwk: crypto.JsonWebKey) => [jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' })]));
  }
  const key = keys.get(kid);
  if (!key) throw new Error(`Unknown Apple key ${kid}`);
  return key;
}

export interface AppleIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
  /** true when the user chose Hide My Email and the address is an Apple relay */
  privateEmail: boolean;
}

// Apple sends these flags as either booleans or the strings "true"/"false".
const isTrue = (v: unknown) => v === true || v === 'true';

/** Checks an identity token from native Sign in with Apple: signature, issuer, audience and expiry. Throws if any fail. */
export async function verifyAppleIdentityToken(token: string): Promise<AppleIdentity> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header.kid) throw new Error('Malformed Apple identity token');
  const payload = jwt.verify(token, await keyFor(decoded.header.kid), {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: APPLE_AUDIENCE,
  });
  if (!payload.sub) throw new Error('Apple identity token has no subject');
  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: isTrue(payload.email_verified),
    privateEmail: isTrue(payload.is_private_email),
  };
}
