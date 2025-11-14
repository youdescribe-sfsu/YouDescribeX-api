import { Router } from 'express';
import { Routes } from '../interfaces/routes.interface';
import UsersController from '../controllers/users.controller';

class AiRoute implements Routes {
  public path = '/ai';
  public router = Router();
  public usersController = new UsersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/description/lana`, this.usersController.requestAiDescriptionsWithLana);
  }
}

export default AiRoute;
