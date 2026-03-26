import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import passport from 'passport';
import { PASSPORT_REDIRECT_URL } from '../config';
import { logger } from '../utils/logger';
import { MongoUsersModel } from '../models/mongodb/init-models.mongo';
import AuthService from '../services/auth.service';
import { isValidObjectId } from 'mongoose';
import { nowUtc } from '../utils/util';

class AuthController {
  private readonly authService: AuthService = new AuthService();

  private ensureLocalDevUser = async (preferredId?: string) => {
    const devEmail = 'local-dev@youdescribe.local';
    const query = preferredId && isValidObjectId(preferredId) ? { _id: preferredId } : { email: devEmail };

    const user = await MongoUsersModel.findOneAndUpdate(
      query,
      {
        $set: {
          email: devEmail,
          name: 'Local Dev User',
          username: preferredId || 'local-dev-user',
          picture: '/assets/img/YD_Icon_Navy.png',
          token: crypto.randomUUID(),
          updated_at: nowUtc(),
          last_login: nowUtc(),
          user_type: 'Volunteer',
          admin_level: 0,
          opt_in: false,
          google_user_id: 'local-dev-user',
        },
        $setOnInsert: {
          created_at: nowUtc(),
        },
      },
      {
        new: true,
        upsert: true,
      },
    );

    return user;
  };

  public initAuthentication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.session.returnTo = req.query.returnTo as string; // Store return URL in session

      passport.authenticate('google', {
        scope: ['profile', 'email', 'openid'],
      })(req, res, next);
    } catch (error) {
      logger.error('Error signing in: ', error);
      next(error);
    }
  };

  public handleGoogleCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      passport.authenticate('google', {
        successRedirect: req.session?.returnTo || PASSPORT_REDIRECT_URL,
        failureRedirect: PASSPORT_REDIRECT_URL,
        failureFlash: 'Sign In Unsuccessful. Please try again!',
      })(req, res, next);
    } catch (error) {
      logger.error('Error with Google Callback: ', error);
      next(error);
    }
  };

  public logIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user) {
        const ret = {
          type: 'success',
          code: 1012,
          status: 200,
          message: 'The user was successfully updated',
          result: req.user,
        };
        res.status(ret.status).json(ret);
      } else {
        const ret = {
          type: 'system_error',
          code: 1,
          status: 500,
          message: 'Internal server error',
        };
        res.status(ret.status).json(ret);
      }
    } catch (error) {
      next(error);
    }
  };

  public logOut = async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.logout((err: Error) => {
        if (err) {
          logger.error('Error during logout: ', err);
        }
      });
      console.log('req.user: ', req.query);
      res.redirect((req.query['url'] as string) || PASSPORT_REDIRECT_URL);
    } catch (error) {
      next(error);
    }
  };

  public localLogIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authorizationHeader = req.headers.authorization?.trim();
      let user = authorizationHeader ? await MongoUsersModel.findById(authorizationHeader) : null;

      if (!user) {
        user = await this.ensureLocalDevUser(authorizationHeader);
      }

      if (!user) {
        throw new Error('Unable to create local development user');
      }

      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }

        return res.status(200).json({
          type: 'success',
          code: 1012,
          status: 200,
          message: 'The user was successfully updated',
          result: user,
        });
      });
    } catch (error) {
      logger.error('Error with Google Callback: ', error);
      next(error);
    }
  };

  public initAppleAuthentication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Initiating Apple Authentication');
      passport.authenticate('apple', { scope: ['name', 'email'] })(req, res, next);
    } catch (error) {
      logger.error('Error signing in with Apple: ', error);
      next(error);
    }
  };

  public handleAppleCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Handling Apple Callback');
      passport.authenticate('apple', function (err, user, info) {
        if (err) {
          if (err == 'AuthorizationError') {
            res.send(
              'Oops! Looks like you didn\'t allow the app to proceed. Please sign in again! <br /> \
                <a href="/login">Sign in with Apple</a>',
            );
          } else if (err == 'TokenError') {
            res.send(
              'Oops! Couldn\'t get a valid token from Apple\'s servers! <br /> \
                <a href="/login">Sign in with Apple</a>',
            );
          } else {
            res.send(err);
          }
        } else {
          if (req.body.user) {
            // Get the profile info (name and email) if the person is registering
            res.json({
              user: req.body.user,
              idToken: user,
            });
          } else {
            res.json(user);
          }
        }
      })(req, res, next);
    } catch (error) {
      logger.error('Error with Apple Callback: ', error);
      next(error);
    }
  };
}

export default AuthController;
