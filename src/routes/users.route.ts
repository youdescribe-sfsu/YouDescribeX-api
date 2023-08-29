import { Router } from 'express';
import UsersController from '../controllers/users.controller';
import { Routes } from '../interfaces/routes.interface';

class UsersRoute implements Routes {
  public path = '/create-user-links';
  public router = Router();
  public usersController = new UsersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get-all-users`, this.usersController.getUsers);
    this.router.get(`${this.path}/user-email`, this.usersController.getUserByEmail);
    this.router.post(`${this.path}/add-new-user`, this.usersController.createUser);
    this.router.post(`${this.path}/create-new-user-ad`, this.usersController.createNewUserAudioDescription);
    this.router.post(`${this.path}/create-user`, this.usersController.createNewUser);
    this.router.post(`${this.path}/request-ai-descriptions-with-gpu`, this.usersController.requestAiDescriptionsWithGpu);

    this.router.post(`${this.path}/generate-audio-desc-gpu`, this.usersController.generateAudioDescGpu);

    this.router.post(`${this.path}/ai-description-status`, this.usersController.aiDescriptionStatus);
  }
}

export default UsersRoute;
