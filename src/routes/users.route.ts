import { Router } from 'express';
import UsersController from '../controllers/users.controller';
import { Routes } from '../interfaces/routes.interface';

class UsersRoute implements Routes {
  public path = '/users';
  public router = Router();
  public usersController = new UsersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/add-new-user`, this.usersController.createUser);
    this.router.post(`${this.path}/create-new-user-ad`, this.usersController.createNewUserAudioDescription);
  }
}

export default UsersRoute;
