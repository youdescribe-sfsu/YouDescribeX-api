import { Router } from 'express';
import UsersController from '../controllers/users.controller';
import { Routes } from '../interfaces/routes.interface';
import authMiddleware from '../middlewares/auth.middleware'; // xiao: session guard for protected routes

class UsersRoute implements Routes {
  public path = '/users';
  public router = Router();
  public usersController = new UsersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get-all-users`, authMiddleware, this.usersController.getUsers);
    this.router.get(`${this.path}/user-email`, authMiddleware, this.usersController.getUserByEmail);
    this.router.post(`${this.path}/add-new-user`, authMiddleware, this.usersController.createUser);
    this.router.post(`${this.path}/create-new-user-ad`, authMiddleware, this.usersController.createNewUserAudioDescription);
    this.router.post(`${this.path}/create-collaborative-ad`, authMiddleware, this.usersController.createCollaborativeDescription);
    this.router.post(`${this.path}/calculate-contributions`, authMiddleware, this.usersController.calculateContributions);
    this.router.post(`${this.path}/create-user`, this.usersController.createNewUser);
    this.router.post(`${this.path}/request-ai-descriptions-with-gpu`, authMiddleware, this.usersController.requestAiDescriptionsWithGpu);
    this.router.get(`${this.path}/ai-service-status`, this.usersController.getAiServiceStatus);
    this.router.get(`${this.path}/processAllClipsInDB/:ad_id`, this.usersController.processAllClipsInDBController);
    this.router.post(`${this.path}/generate-audio-desc-gpu`, authMiddleware, this.usersController.generateAudioDescGpu);
    this.router.post(`${this.path}/generate-ai-descriptions`, authMiddleware, this.usersController.generateAiDescriptions);
    this.router.post(`${this.path}/increase-Request-Count`, authMiddleware, this.usersController.increaseRequestCount);
    this.router.post(`${this.path}/ai-description-status`, authMiddleware, this.usersController.aiDescriptionStatus);
    this.router.get(`${this.path}/get-user-Ai-DescriptionRequests`, authMiddleware, this.usersController.getUserAiDescriptionRequests);
    this.router.post(`${this.path}/save-Visited-Videos-History`, authMiddleware, this.usersController.saveVisitedVideosHistory);
    this.router.get(`${this.path}/get-Visited-Videos-History`, authMiddleware, this.usersController.getVisitedVideosHistory);
    this.router.post(`${this.path}/pipeline-failure`, this.usersController.handlePipelineFailure);
    this.router.post(`${this.path}/request-ai-descriptions-with-lana`, authMiddleware, this.usersController.requestAiDescriptionsWithLana);
    this.router.post(`${this.path}/updateoptin`, authMiddleware, this.usersController.updateOptIn);

    this.router.get(`${this.path}/me`, authMiddleware, this.usersController.getMe);
    this.router.get(`${this.path}/:userId`, authMiddleware, this.usersController.getUserById);
  }
}

export default UsersRoute;
