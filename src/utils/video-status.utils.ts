import { logger } from './logger';
import { MongoVideosModel, MongoWishListModel, MongoAudio_Descriptions_Model, MongoUserVotesModel } from '../models/mongodb/init-models.mongo';
import YouTubeCacheService from '../services/youtube-cache.service';
import { nowUtc } from './util';

interface VideoStatusUpdateStats {
  videoId: string;
  updatedCollections: string[];
  affectedRecords: number;
  errors: string[];
}

export const markVideoUnavailable = async (youtubeId: string): Promise<VideoStatusUpdateStats> => {
  const stats: VideoStatusUpdateStats = {
    videoId: youtubeId,
    updatedCollections: [],
    affectedRecords: 0,
    errors: [],
  };

  const session = await MongoVideosModel.startSession();

  try {
    await session.withTransaction(async () => {
      const videoUpdateResult = await MongoVideosModel.updateOne(
        { youtube_id: youtubeId },
        {
          $set: {
            youtube_status: 'unavailable',
            updated_at: nowUtc(),
          },
        },
        { session },
      );

      if (videoUpdateResult.modifiedCount > 0) {
        stats.updatedCollections.push('videos');
        stats.affectedRecords += videoUpdateResult.modifiedCount;
      }

      const wishlistUpdateResult = await MongoWishListModel.updateMany(
        { youtube_id: youtubeId },
        {
          $set: {
            youtube_status: 'unavailable',
            status: 'removed',
            updated_at: nowUtc(),
          },
        },
        { session },
      );

      if (wishlistUpdateResult.modifiedCount > 0) {
        stats.updatedCollections.push('wishlist');
        stats.affectedRecords += wishlistUpdateResult.modifiedCount;
      }

      const audioDescUpdateResult = await MongoAudio_Descriptions_Model.updateMany(
        { video: youtubeId },
        {
          $set: {
            status: 'archived',
            updated_at: nowUtc(),
          },
        },
        { session },
      );

      if (audioDescUpdateResult.modifiedCount > 0) {
        stats.updatedCollections.push('audio_descriptions');
        stats.affectedRecords += audioDescUpdateResult.modifiedCount;
      }

      const votesUpdateResult = await MongoUserVotesModel.updateMany(
        { youtube_id: youtubeId },
        {
          $set: {
            status: 'archived',
            updated_at: nowUtc(),
          },
        },
        { session },
      );

      if (votesUpdateResult.modifiedCount > 0) {
        stats.updatedCollections.push('user_votes');
        stats.affectedRecords += votesUpdateResult.modifiedCount;
      }
    });

    logger.info(`Successfully updated status for video ${youtubeId}`, stats);
  } catch (error) {
    stats.errors.push(`Transaction failed: ${error.message}`);
    logger.error(`Failed to update video status for ${youtubeId}:`, error);
  } finally {
    await session.endSession();
  }

  return stats;
};

export const checkAndUpdateVideoStatuses = async (): Promise<VideoStatusUpdateStats[]> => {
  const allStats: VideoStatusUpdateStats[] = [];

  try {
    const videos = await MongoVideosModel.find({
      youtube_status: 'available',
    });

    for (const video of videos) {
      try {
        const response = await YouTubeCacheService.getVideoData([video.youtube_id]);

        if (!response?.items?.length) {
          const stats = await markVideoUnavailable(video.youtube_id);
          allStats.push(stats);
        }
      } catch (error) {
        logger.error(`Error checking video ${video.youtube_id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Failed to complete video status check:', error);
  }

  return allStats;
};
