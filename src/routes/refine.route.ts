// xiao1009 Route registration for RefineAD. Mirrors notes.route.ts:6-18; app.ts:163 mounts every
// router under '/api/', so this becomes POST /api/refine/suggest. authMiddleware is mandatory: a
// suggestion can only be requested for a description the signed-in user owns.
import { Router } from 'express';
import RefineController from '../controllers/refine.controller';
import { Routes } from '../interfaces/routes.interface';
import authMiddleware from '../middlewares/auth.middleware';

class RefineRoute implements Routes {
  public path = '/refine';
  public router = Router();
  public refineController = new RefineController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/suggest`, authMiddleware, this.refineController.suggest);
  }
}

export default RefineRoute;
