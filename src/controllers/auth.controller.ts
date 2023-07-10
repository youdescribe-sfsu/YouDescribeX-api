import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { PASSPORT_REDIRECT_URL } from '../config/index';
import { logger } from '../utils/logger';

class AuthController {
  public initAuthentication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      passport.authenticate('google', { scope: ['profile', 'email', 'openid'] })(req, res, next);
    } catch (error) {
      logger.error('Error signing in: ', error);
      next(error);
    }
  };

  public handleGoogleCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      passport.authenticate('google', {
        successRedirect: PASSPORT_REDIRECT_URL,
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
      res.redirect(PASSPORT_REDIRECT_URL);
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
