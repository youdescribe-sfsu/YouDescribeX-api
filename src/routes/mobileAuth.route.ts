import { Router } from 'express';
import MobileAuthController from '../controllers/mobileAuth.controller';
import { Routes } from '../interfaces/routes.interface';

class MobileAuthRoute implements Routes {
  public path = '/auth/mobile';
  public router = Router();
  public mobileAuthController = new MobileAuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/google`, this.mobileAuthController.google);
  }
}

export default MobileAuthRoute;
