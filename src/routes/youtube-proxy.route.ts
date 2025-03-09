import { Router } from 'express';
import { Routes } from '../interfaces/routes.interface';
import YouTubeProxyController from '../controllers/youtube-proxy.controller';

class YouTubeProxyRoute implements Routes {
  public path = '/youtube-proxy';
  public router = Router();
  public youtubeProxyController = new YouTubeProxyController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/videos`, this.youtubeProxyController.getVideos);
    this.router.delete(`${this.path}/cache`, this.youtubeProxyController.invalidateCache);
    this.router.get(`${this.path}/quota`, this.youtubeProxyController.getQuotaUsage);
    this.router.delete(`${this.path}/clear-cache`, this.youtubeProxyController.clearCache);
  }
}

export default YouTubeProxyRoute;
