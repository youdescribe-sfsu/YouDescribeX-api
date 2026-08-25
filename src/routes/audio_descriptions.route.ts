import { Router } from 'express';
import AudioDescriptionsController from '../controllers/audioDescriptions.controller';
import { Routes } from '../interfaces/routes.interface';
import authMiddleware from '../middlewares/auth.middleware'; // xiao: session guard for protected routes

class AudioDescriptionsRoute implements Routes {
  public path = '/audio-descriptions';
  public router = Router();
  public audioDescriptionsController = new AudioDescriptionsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get-user-ad/:videoId&:adId`, authMiddleware, this.audioDescriptionsController.getUserAudioDescriptionData);
    this.router.post(`${this.path}/newaidescription`, this.audioDescriptionsController.newAiDescription);
    this.router.post(`${this.path}/aidescription-failure`, this.audioDescriptionsController.aidescriptionFailure);
    this.router.delete(`${this.path}/delete-user-ad-audios/:youtubeVideoId&:adId`, authMiddleware, this.audioDescriptionsController.deleteUserADAudios);
    this.router.post(`${this.path}/publish-audio-description`, authMiddleware, this.audioDescriptionsController.publishAudioDescription);
    this.router.post(`${this.path}/unpublish-audio-description`, authMiddleware, this.audioDescriptionsController.unpublishAudioDescription);
    this.router.get(`${this.path}/get-audio-description/:audioDescriptionId`, this.audioDescriptionsController.getAudioDescription);
    this.router.get(`${this.path}/get-my-descriptions`, authMiddleware, this.audioDescriptionsController.getMyDescriptions);
    this.router.get(`${this.path}/get-my-draft-descriptions`, authMiddleware, this.audioDescriptionsController.getMyDraftDescriptions);
    this.router.get(`${this.path}/get-All-AI-descriptions`, this.audioDescriptionsController.getAllAIDescriptions);
  }
}

export default AudioDescriptionsRoute;
