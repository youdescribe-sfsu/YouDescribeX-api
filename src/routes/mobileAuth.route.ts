import { Router } from 'express';
import MobileAuthController from '../controllers/mobileAuth.controller';
import { Routes } from '../interfaces/routes.interface';
import authMiddleware from '../middlewares/auth.middleware';

class MobileAuthRoute implements Routes {
  public path = '/auth/mobile';
  public router = Router();
  public mobileAuthController = new MobileAuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/google`, this.mobileAuthController.google);
    this.router.post(`${this.path}/apple`, this.mobileAuthController.apple);
    this.router.delete(`${this.path}/account`, authMiddleware, this.mobileAuthController.deleteAccount);
  }
}

export default MobileAuthRoute;
