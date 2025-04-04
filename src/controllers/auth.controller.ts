import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { PASSPORT_REDIRECT_URL } from '../config';
import { logger } from '../utils/logger';
import { MongoUsersModel } from '../models/mongodb/init-models.mongo';
import AuthService from '../services/auth.service';

class AuthController {
  private readonly authService: AuthService = new AuthService();

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
      if (req.headers.authorization === undefined || req.headers.authorization === '') {
        throw new Error('Authorization header not found');
      }
      const user = await MongoUsersModel.findById(req.headers.authorization);
      const ret = {
        type: 'success',
        code: 1012,
        status: 200,
        message: 'The user was successfully updated',
        result: user,
      };
      req.logIn(user, function (err) {
        if (err) {
          // console.log('error: ', err);
          return next(err);
        }
        return res.redirect('/api/auth/login/success');
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
