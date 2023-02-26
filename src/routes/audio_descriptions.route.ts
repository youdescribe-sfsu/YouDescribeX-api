import { Router } from 'express';
import AudioDescriptionsController from '../controllers/audioDescriptions.controller';
import { Routes } from '../interfaces/routes.interface';

class AudioDescriptionsRoute implements Routes {
  public path = '/audioDescriptions';
  public router = Router();
  public audioDescriptionsController = new AudioDescriptionsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get-user-ad/:videoId&:userId`, this.audioDescriptionsController.getUserAudioDescriptionData);
    this.router.post(`${this.path}/newaidescription`, this.audioDescriptionsController.newAiDescription);
    //   this.router.post(`${this.path}/newdescription`, this.audioDescriptionsController.newDescription);
    this.router.delete(`${this.path}/delete-user-ad-audios/:youtubeVideoId&:userId`, this.audioDescriptionsController.deleteUserADAudios);
  }
}

export default AudioDescriptionsRoute;
