import axios from 'axios';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { APPLE_AUDIENCE, APPLE_ISSUER } from './appleIdToken';
import { logger } from './logger';

/**
 * Apple needs a short-lived "client secret": a JWT signed with the team's Sign in with Apple private key.
 * The key file defaults to the one at the repo root (AuthKey_<key ID>.p8); APPLE_PRIVATE_KEY_PATH overrides it.
 */
function clientSecret(): string | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  if (!teamId || !keyId) {
    logger.warn('Apple revoke skipped: APPLE_TEAM_ID or APPLE_KEY_ID is not set');
    return null;
  }
  const keyPath = process.env.APPLE_PRIVATE_KEY_PATH || path.join(process.cwd(), `AuthKey_${keyId}.p8`);
  if (!fs.existsSync(keyPath)) {
    logger.warn(`Apple revoke skipped: no private key at ${keyPath}`);
    return null;
  }
  return jwt.sign({}, fs.readFileSync(keyPath), {
    algorithm: 'ES256',
    keyid: keyId,
    issuer: teamId,
    subject: APPLE_AUDIENCE,
    audience: APPLE_ISSUER,
    expiresIn: 300,
  });
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
const FORM_HEADERS = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 };

/**
 * When an account made with Sign in with Apple is deleted, Apple expects the app's access to be revoked.
 * The app sends a fresh authorization code; it is traded for a refresh token, which is then revoked.
 * Does nothing when the key is not configured, and throws if Apple refuses.
 */
export async function revokeAppleSignIn(authorizationCode: string): Promise<void> {
  const secret = clientSecret();
  if (!secret) return;
  const client = { client_id: APPLE_AUDIENCE, client_secret: secret };
  const { data } = await axios.post(`${APPLE_ISSUER}/auth/token`, form({ ...client, code: authorizationCode, grant_type: 'authorization_code' }), FORM_HEADERS);
  await axios.post(`${APPLE_ISSUER}/auth/revoke`, form({ ...client, token: data.refresh_token, token_type_hint: 'refresh_token' }), FORM_HEADERS);
}
