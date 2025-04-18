import { Router } from 'express';
import AudioDescriptionsController from '../controllers/audioDescriptions.controller';
import { Routes } from '../interfaces/routes.interface';

class AudioDescriptionsRoute implements Routes {
  public path = '/audio-descriptions';
  public router = Router();
  public audioDescriptionsController = new AudioDescriptionsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get-user-ad/:videoId&:adId`, this.audioDescriptionsController.getUserAudioDescriptionData);
    this.router.post(`${this.path}/newaidescription`, this.audioDescriptionsController.newAiDescription);
    this.router.delete(`${this.path}/delete-user-ad-audios/:youtubeVideoId&:adId`, this.audioDescriptionsController.deleteUserADAudios);
    this.router.post(`${this.path}/publish-audio-description`, this.audioDescriptionsController.publishAudioDescription);
    this.router.post(`${this.path}/unpublish-audio-description`, this.audioDescriptionsController.unpublishAudioDescription);
    this.router.get(`${this.path}/get-audio-description/:audioDescriptionId`, this.audioDescriptionsController.getAudioDescription);
    this.router.get(`${this.path}/get-my-descriptions`, this.audioDescriptionsController.getMyDescriptions);
    this.router.get(`${this.path}/get-my-draft-descriptions`, this.audioDescriptionsController.getMyDraftDescriptions);
    this.router.get(`${this.path}/get-All-AI-descriptions`, this.audioDescriptionsController.getAllAIDescriptions);
  }
}

export default AudioDescriptionsRoute;
