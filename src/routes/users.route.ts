import { Router } from 'express';
import UsersController from '../controllers/users.controller';
import { Routes } from '../interfaces/routes.interface';
import { withTransaction } from '../middlewares/transaction.middleware';

class UsersRoute implements Routes {
  public path = '/users';
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
    this.router.post(`${this.path}/create-collaborative-ad`, withTransaction(this.usersController.createCollaborativeDescription));
    this.router.post(`${this.path}/calculate-contributions`, this.usersController.calculateContributions);
    this.router.post(`${this.path}/create-user`, this.usersController.createNewUser);
    this.router.post(`${this.path}/request-ai-descriptions-with-gpu`, this.usersController.requestAiDescriptionsWithGpu);
    this.router.get(`${this.path}/ai-service-status`, this.usersController.getAiServiceStatus);
    this.router.get(`${this.path}/processAllClipsInDB/:ad_id`, this.usersController.processAllClipsInDBController);
    this.router.post(`${this.path}/generate-audio-desc-gpu`, this.usersController.generateAudioDescGpu);
    this.router.post(`${this.path}/generate-ai-descriptions`, this.usersController.generateAiDescriptions);
    this.router.post(`${this.path}/increase-Request-Count`, this.usersController.increaseRequestCount);
    this.router.post(`${this.path}/ai-description-status`, this.usersController.aiDescriptionStatus);
    this.router.get(`${this.path}/get-user-Ai-DescriptionRequests`, this.usersController.getUserAiDescriptionRequests);
    this.router.post(`${this.path}/save-Visited-Videos-History`, this.usersController.saveVisitedVideosHistory);
    this.router.get(`${this.path}/get-Visited-Videos-History`, this.usersController.getVisitedVideosHistory);
    this.router.post(`${this.path}/pipeline-failure`, this.usersController.handlePipelineFailure);
    this.router.post(`${this.path}/info-bot`, this.usersController.infoBotGenerateAnswer);
  }
}

export default UsersRoute;
