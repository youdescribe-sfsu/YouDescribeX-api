import { Router } from 'express';
import { Routes } from '../interfaces/routes.interface';
import YouTubeProxyController from '../controllers/youtube-proxy.controller';
import authMiddleware from '../middlewares/auth.middleware';

class YouTubeProxyRoute implements Routes {
  public path = '/youtube-proxy';
  public router = Router();
  public youtubeProxyController = new YouTubeProxyController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/videos`, this.youtubeProxyController.getVideos);
    this.router.delete(`${this.path}/cache`, authMiddleware, this.youtubeProxyController.invalidateCache);
    this.router.get(`${this.path}/quota`, authMiddleware, this.youtubeProxyController.getQuotaUsage);
    this.router.delete(`${this.path}/clear-cache`, authMiddleware, this.youtubeProxyController.clearCache);
  }
}

export default YouTubeProxyRoute;
