import { NextFunction, Request, Response, Router } from 'express';
import passport from 'passport';
import AuthController from '../controllers/auth.controller';
import { Routes } from '../interfaces/routes.interface';
import { PASSPORT_REDIRECT_URL } from '../config/index';
import { ParsedQs } from 'qs';
import AuthService from '../services/auth.service';

class AuthRoute implements Routes {
  public path = '/auth';
  public router = Router();
  public authController = new AuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Middleware to validate return URL
    const validateReturnUrl = (req: Request, res: Response, next: NextFunction) => {
      const returnTo = req.query.returnTo as string;
      if (returnTo) {
        const authService = new AuthService();
        if (!authService.validateReturnUrl(returnTo)) {
          return next(new Error('Invalid return URL'));
        }
      }
      next();
    };

    this.router.get(`${this.path}/google`, validateReturnUrl, this.authController.initAuthentication);

    this.router.get(`${this.path}/google/callback`, this.authController.handleGoogleCallback);

    // Local Strategy
    this.router.get(`${this.path}/google/localhost`, this.authController.localLogIn);

    this.router.get(`${this.path}/login/success`, this.authController.logIn);

    this.router.get(`${this.path}/logout`, this.authController.logOut);

    this.router.get(`${this.path}/apple`, this.authController.initAppleAuthentication);

    this.router.post(`${this.path}/apple/callback`, this.authController.handleAppleCallback);
  }
}

export default AuthRoute;
