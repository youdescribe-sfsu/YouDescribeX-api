import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import moment from 'moment';
import { CRYPTO_SECRET, CRYPTO_SEED } from '../config';
import MobileAuthService from '../services/mobileAuth.service';
import { verifyAppleIdentityToken } from '../utils/appleIdToken';
import { logger } from '../utils/logger';

/** The web OAuth client. The mobile app requests ID tokens for it, so this is the token's audience. */
export const GOOGLE_WEB_CLIENT_ID = '1061361249208-9799kv6172rjgmk4gad077639dfrck82.apps.googleusercontent.com';

// Same token format as the passport Google strategy (models/mongodb/init-models.mongo.ts).
const newSessionToken = () =>
  crypto
    .createHmac('sha256', CRYPTO_SECRET)
    .update(CRYPTO_SEED + moment().utc().format('YYYYMMDDHHmmss'))
    .digest('hex');

/**
 * Native sign-in for the mobile app: the app signs in with Google's or Apple's SDK and sends the resulting token
 * here. After the token is checked, MobileAuthService finds or creates the account (one account per person across
 * Google and Apple), and the usual session cookie is set.
 */
class MobileAuthController {
  private readonly googleClient = new OAuth2Client();
  private readonly mobileAuthService = new MobileAuthService();

  public google = async (req: Request, res: Response, next: NextFunction) => {
    const idToken = req.body?.idToken;
    if (typeof idToken !== 'string' || idToken === '') {
      return res.status(400).json({ message: 'idToken is required' });
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: GOOGLE_WEB_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (error) {
      logger.warn('Rejected mobile Google ID token: ', error);
      return res.status(401).json({ message: 'Invalid Google sign-in' });
    }
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({ message: 'Invalid Google sign-in' });
    }

    try {
      const user = await this.mobileAuthService.findOrCreateUser({
        provider: 'google',
        sub: payload.sub,
        email: payload.email,
        emailTrusted: true, // unverified emails were rejected above
        token: newSessionToken(),
        name: payload.name ?? '',
        given_name: payload.given_name ?? '',
        picture: payload.picture ?? '',
        locale: payload.locale ?? '',
      });
      this.startSession(req, res, next, user);
    } catch (error) {
      logger.error('Error signing in with mobile Google token: ', error);
      next(error);
    }
  };

  public apple = async (req: Request, res: Response, next: NextFunction) => {
    const identityToken = req.body?.identityToken;
    if (typeof identityToken !== 'string' || identityToken === '') {
      return res.status(400).json({ message: 'identityToken is required' });
    }

    let identity;
    try {
      identity = await verifyAppleIdentityToken(identityToken);
    } catch (error) {
      logger.warn('Rejected mobile Apple identity token: ', error);
      return res.status(401).json({ message: 'Invalid Apple sign-in' });
    }

    // Apple sends the name to the app only on the first sign-in, so the app forwards it when it has it.
    const givenName = typeof req.body.fullName?.givenName === 'string' ? req.body.fullName.givenName : '';
    const familyName = typeof req.body.fullName?.familyName === 'string' ? req.body.fullName.familyName : '';

    try {
      const user = await this.mobileAuthService.findOrCreateUser({
        provider: 'apple',
        sub: identity.sub,
        email: identity.email ?? '',
        // A Hide My Email relay address never matches another account, and must not be used to join one.
        emailTrusted: Boolean(identity.email) && identity.emailVerified && !identity.privateEmail,
        token: newSessionToken(),
        name: [givenName, familyName].filter(Boolean).join(' '),
        given_name: givenName,
      });
      this.startSession(req, res, next, user);
    } catch (error) {
      logger.error('Error signing in with mobile Apple token: ', error);
      next(error);
    }
  };

  private startSession(req: Request, res: Response, next: NextFunction, user: unknown) {
    req.logIn(user as any, err => {
      if (err) return next(err);
      res.status(200).json({
        type: 'success',
        code: 1012,
        status: 200,
        message: 'The user was successfully updated',
        result: user,
      });
    });
  }
}

export default MobileAuthController;
