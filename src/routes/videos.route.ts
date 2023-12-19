import { Router } from 'express';
import VideosController from '../controllers/videos.controller';
import { Routes } from '../interfaces/routes.interface';
// import validationMiddleware from '../middlewares/validation.middleware';

class VideosRoute implements Routes {
  public path = '/videos';
  public router = Router();
  public videosController = new VideosController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get-all-videos`, this.videosController.getAllVideos);
    this.router.get(`${this.path}/get-by-youtubeVideo/:youtubeId`, this.videosController.getVideobyYoutubeId);
    this.router.delete(`${this.path}/delete-video/:youtubeId/:userId`, this.videosController.deleteVideoForUser);
    this.router.get(`${this.path}/user/:userId`, this.videosController.getVideosForUserId);
    this.router.get(`${this.path}/getyoutubedatafromcache`, this.videosController.getYoutubeDataFromCache);
    this.router.get(`${this.path}/:videoId`, this.videosController.getVideoById);
    // this.router.post(`${this.path}/create-new-user-ad`, this.usersController.createNewUserAudioDescription);
    // this.router.get(`${this.path}`, this.usersController.getUsers);
    // this.router.get(`${this.path}/:id`, this.usersController.getUserById);
    // this.router.post(`${this.path}`, validationMiddleware(CreateUserDto, 'body'), this.usersController.createUser);
    // this.router.put(`${this.path}/:id`, validationMiddleware(CreateUserDto, 'body', true), this.usersController.updateUser);
    // this.router.delete(`${this.path}/:id`, this.usersController.deleteUser);
  }
}

export default VideosRoute;
