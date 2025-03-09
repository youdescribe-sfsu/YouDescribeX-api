import { NextFunction, Request, Response } from 'express';
import YouTubeCacheService from '../services/youtube-cache.service';
import { logger } from '../utils/logger';
import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { IUser } from '../models/mongodb/User.mongo';
import { convertISO8601ToSeconds } from '../utils/util';
import App from '../app';

class YouTubeProxyController {
  private youtubeCacheService = YouTubeCacheService;

  public getVideos = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoIdsParam = req.query.id as string;

      if (isEmpty(videoIdsParam)) {
        throw new HttpException(400, 'Video IDs are required');
      }

      const videoIds = videoIdsParam.split(',');

      // Track quota usage
      this.trackQuotaUsage(req, videoIds.length);

      const videoData = await this.youtubeCacheService.getVideoData(videoIds);

      // Process data to match the format expected by frontend
      const processedData = this.processVideoData(videoData);

      res.status(200).json(processedData);
    } catch (error) {
      logger.error(`YouTube proxy error: ${error.message}`);
      next(error);
    }
  };

  private trackQuotaUsage(req: Request, queryCount: number): void {
    // Increment the application-level counter
    App.numOfVideosFromYoutube += queryCount;

    // Log the user making the request
    const user = req.user as IUser;
    if (user) {
      logger.info(`YouTube API quota usage: ${queryCount} videos by user ${user._id}`);
    } else {
      logger.info(`YouTube API quota usage: ${queryCount} videos by anonymous user`);
    }
  }

  private processVideoData(videoData: any): any {
    if (!videoData.items) {
      return { items: [] };
    }

    // Process the video data to include calculated fields
    const processedItems = videoData.items.map((item: any) => {
      if (item.contentDetails && item.contentDetails.duration) {
        item.duration = convertISO8601ToSeconds(item.contentDetails.duration);
      }
      return item;
    });

    return { items: processedItems };
  }

  public invalidateCache = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoIdsParam = req.query.id as string;

      if (isEmpty(videoIdsParam)) {
        throw new HttpException(400, 'Video IDs are required');
      }

      const videoIds = videoIdsParam.split(',');
      await this.youtubeCacheService.invalidateCache(videoIds);

      res.status(200).json({ message: `Cache invalidated for ${videoIds.length} videos` });
    } catch (error) {
      logger.error(`Cache invalidation error: ${error.message}`);
      next(error);
    }
  };

  public getQuotaUsage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only allow admin users to access this endpoint
      const user = req.user as IUser;
      if (!user || user.admin_level < 2) {
        throw new HttpException(403, 'Unauthorized access');
      }

      // Calculate daily usage
      const today = new Date().toISOString().split('T')[0];
      const dailyUsage = App.numOfVideosFromYoutube;

      res.status(200).json({
        daily_usage: dailyUsage,
        date: today,
        estimated_quota_units: dailyUsage, // Each video request costs 1 quota unit
        quota_limit: 10000, // Replace with your actual quota limit
        remaining: 10000 - dailyUsage, // Estimate remaining quota
      });
    } catch (error) {
      logger.error(`Quota usage error: ${error.message}`);
      next(error);
    }
  };

  public clearCache = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only allow admin users to access this endpoint
      const user = req.user as IUser;
      if (!user || user.admin_level < 2) {
        throw new HttpException(403, 'Unauthorized access');
      }

      await this.youtubeCacheService.clearCache();

      res.status(200).json({ message: 'YouTube cache cleared successfully' });
    } catch (error) {
      logger.error(`Cache clearing error: ${error.message}`);
      next(error);
    }
  };
}

export default YouTubeProxyController;
