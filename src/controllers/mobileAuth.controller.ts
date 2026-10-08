import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import moment from 'moment';
import { CRYPTO_SECRET, CRYPTO_SEED } from '../config';
import UserService from '../services/users.service';
import { logger } from '../utils/logger';

/** The web OAuth client. The mobile app requests ID tokens for it, so this is the token's audience. */
export const GOOGLE_WEB_CLIENT_ID = '1061361249208-9799kv6172rjgmk4gad077639dfrck82.apps.googleusercontent.com';

/**
 * Native Google sign-in for the mobile app: the app signs in with Google's SDK and sends the ID token here.
 * Google's library checks the signature, expiry and audience; the user is then found or created exactly as the
 * web login does, so one person has one account on web and mobile.
 */
class MobileAuthController {
  private readonly googleClient = new OAuth2Client();
  private readonly userService = new UserService();

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
      // Same fields and token format as the passport Google strategy (models/mongodb/init-models.mongo.ts).
      const token = crypto
        .createHmac('sha256', CRYPTO_SECRET)
        .update(CRYPTO_SEED + moment().utc().format('YYYYMMDDHHmmss'))
        .digest('hex');
      const user = await this.userService.createNewUser({
        email: payload.email,
        name: payload.name ?? '',
        given_name: payload.given_name ?? '',
        picture: payload.picture ?? '',
        locale: payload.locale ?? '',
        google_user_id: payload.sub,
        token,
        opt_in: false,
        admin_level: 0,
        user_type: 'Volunteer',
      } as any);

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
    } catch (error) {
      logger.error('Error signing in with mobile Google token: ', error);
      next(error);
    }
  };
}

export default MobileAuthController;
