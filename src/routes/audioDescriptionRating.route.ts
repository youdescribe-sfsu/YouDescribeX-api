import { Router } from 'express';
import AudioDescriptionsRatingController from '../controllers/audioDescriptionRating.controller';
import { Routes } from '../interfaces/routes.interface';

class AudioDescriptionRatingRoute implements Routes {
  public path = '/audio-descriptions/ratings';
  public router = Router();
  public audioDescriptionsRatingController = new AudioDescriptionsRatingController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/addOne/:audioDescriptionId`, this.audioDescriptionsRatingController.addOne);
  }
}

export default AudioDescriptionRatingRoute;
