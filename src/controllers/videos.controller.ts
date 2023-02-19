import { NextFunction, Request, Response } from 'express';
import { IVideos } from '../interfaces/videos.interface';
import VideosService from '../services/videos.service';
import { VideosAttributes } from '../models/postgres/Videos';

class VideosController {
  public videosService = new VideosService();

  public getVideobyYoutubeId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const youtubeId: string = req.params.youtubeId;
      const videoByYoutubeID: IVideos | VideosAttributes = await this.videosService.getVideobyYoutubeId(youtubeId);

      res.status(200).json(videoByYoutubeID);
    } catch (error) {
      next(error);
    }
  };
  public deleteVideoForUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const youtubeId: string = req.params.youtubeId;
      const userId: string = req.params.userId;
      const videoByYoutubeID: IVideos | VideosAttributes = await this.videosService.deleteVideoForUser(youtubeId, userId);
      res
        .status(200)
        .json({ data: `Video with youtubeId: ${videoByYoutubeID.youtube_video_id} deleted for user with id: ${userId}`, message: 'deleted' });
    } catch (error) {
      next(error);
    }
  };
}

export default VideosController;
