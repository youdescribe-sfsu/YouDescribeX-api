import { NextFunction, Request, Response } from 'express';
import { IVideos } from '../interfaces/videos.interface';
import VideosService from '../services/videos.service';
import { VideosAttributes } from '../models/postgres/Videos';

class VideosController {
  public videosService = new VideosService();
  /**
   * @swagger
   * /videos/{youtubeId}:
   *   get:
   *     summary: Get a video by its YouTube ID
   *     tags: [Videos]
   *     parameters:
   *       - in: path
   *         name: youtubeId
   *         schema:
   *           type: string
   *         required: true
   *         description: The YouTube ID of the video
   *     responses:
   *       '200':
   *         description: A video object
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/IVideos'
   *       '404':
   *         description: The video was not found
   */
  public getVideobyYoutubeId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const youtubeId: string = req.params.youtubeId;
      const videoByYoutubeID = await this.videosService.getVideobyYoutubeId(youtubeId);

      res.status(200).json(videoByYoutubeID);
    } catch (error) {
      next(error);
    }
  };

  /**
   * @swagger
   *
   * /videos/{youtubeId}/{userId}:
   *   delete:
   *     summary: Delete a video for a user by its YouTube ID and user ID
   *     tags: [Videos]
   *     parameters:
   *       - name: youtubeId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: The YouTube ID of the video to delete
   *       - name: userId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the user who owns the video to delete
   *     responses:
   *       200:
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: string
   *                   example: "Video with youtubeId: abc123 deleted for user with id: def456"
   *                 message:
   *                   type: string
   *                   example: "deleted"
   */
  public deleteVideoForUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const youtubeId: string = req.params.youtubeId;
      const userId: string = req.params.userId;
      const videoByYoutubeID: any = await this.videosService.deleteVideoForUser(youtubeId, userId);
      res.status(200).json({
        data: `Video with youtubeId: ${videoByYoutubeID.youtube_video_id || videoByYoutubeID.youtube_id} deleted for user with id: ${userId}`,
        message: 'deleted',
      });
    } catch (error) {
      // console.log(error);
      next(error);
    }
  };

  public getVideosForUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.userId;
      const videoByYoutubeID = await this.videosService.getVideosForUserId(userId);
      res.status(200).json(videoByYoutubeID);
    } catch (error) {
      next(error);
    }
  };

  public getVideoById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoId: string = req.params.videoId;
      const videoByYoutubeID = await this.videosService.getVideoById(videoId);
      res.status(200).json(videoByYoutubeID);
    } catch (error) {
      next(error);
    }
  };

  public getAllVideos = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page as string;
      const videos = await this.videosService.getAllVideos(page);

      // Create your response object
      const ret = {
        status: 200, // Set your desired status code
        message: 'Videos fetched successfully',
        result: videos,
      };

      // Send the response
      res.status(ret.status).json(ret);
    } catch (error) {
      // Handle errors
      const ret = {
        status: 500, // Set an appropriate error status code
        message: 'Error fetching videos',
        error: error.message,
      };
      res.status(ret.status).json(ret);
    }
  };

  public getYoutubeDataFromCache = async (req: Request, res: Response, next: NextFunction) => {
    const youtubeIds = req.query.youtubeids as string;
    const key = req.query.key as string;

    try {
      const result = await this.videosService.getYoutubeDataFromCache(youtubeIds, key);
      res.status(result.status).json(result);
    } catch (error) {
      res.status(500).json({ status: 500, error: 'Internal Server Error' });
    }
  };

  public searchVideos = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page as string;
      const searchQuery = req.query.q as string;
      const videos = await this.videosService.getSearchVideos(page, searchQuery);

      // Create your response object
      const ret = {
        status: 200, // Set your desired status code
        message: 'Videos fetched successfully',
        result: videos,
      };

      // Send the response
      res.status(ret.status).json(ret);
    } catch (error) {
      // Handle errors
      const ret = {
        status: 500, // Set an appropriate error status code
        message: 'Error fetching videos',
        error: error.message,
      };
      res.status(ret.status).json(ret);
    }
  };
}

export default VideosController;
