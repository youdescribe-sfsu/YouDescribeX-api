import { Router } from 'express';
import AudioDescriptionsRatingController from '../controllers/audioDescriptionRating.controller';
import { Routes } from '../interfaces/routes.interface';
import authMiddleware from '../middlewares/auth.middleware'; // xiao: session guard for protected routes

class AudioDescriptionRatingRoute implements Routes {
  public path = '/audio-descriptions/ratings';
  public router = Router();
  public audioDescriptionsRatingController = new AudioDescriptionsRatingController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/addOne/:audioDescriptionId`, authMiddleware, this.audioDescriptionsRatingController.addOne);
    this.router.get(`${this.path}/user/:audioDescriptionId`, authMiddleware, this.audioDescriptionsRatingController.getUserRating);
  }
}

export default AudioDescriptionRatingRoute;
