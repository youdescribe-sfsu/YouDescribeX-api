import { Router } from 'express';
import passport from 'passport';
import AuthController from '../controllers/auth.controller';
import { Routes } from '../interfaces/routes.interface';
import { PASSPORT_REDIRECT_URL } from '../config/index';

class AuthRoute implements Routes {
  public path = '/auth';
  public router = Router();
  public authController = new AuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/google`, this.authController.initAuthentication);
    // this.router.get(`${this.path}/google`, passport.authenticate("google", { scope: ["profile","email","openid"] }) );
    this.router.get(`${this.path}/google/callback`, this.authController.handleGoogleCallback);
    // Local Strategy
    this.router.get(`${this.path}/google/localhost`, this.authController.localLogIn);
    // this.router.get(`${this.path}/google/callback`, passport.authenticate("google",
    //                                                 {
    //                                                   successRedirect: PASSPORT_REDIRECT_URL,
    //                                                   failureRedirect: PASSPORT_REDIRECT_URL,
    //                                                   failureFlash: "Sign In Unsuccessful. Please try again!"
    //                                                 }) );
    this.router.get(`${this.path}/login/success`, this.authController.logIn);
    this.router.get(`${this.path}/logout`, this.authController.logOut);
  }
}

export default AuthRoute;
