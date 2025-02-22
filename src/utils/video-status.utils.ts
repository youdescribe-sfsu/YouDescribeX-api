// src/utils/video-status.utils.ts

import { logger } from './logger';
import {
  MongoVideosModel,
  MongoWishListModel,
  MongoAudio_Descriptions_Model,
  MongoUserVotesModel,
  // Import other relevant models
} from '../models/mongodb/init-models.mongo';
import { fetchVideoDetails } from './youtube_utils';
import { nowUtc } from './util';

interface VideoStatusUpdateStats {
  videoId: string;
  updatedCollections: string[];
  affectedRecords: number;
  errors: string[];
}

/**
 * Updates video status across all related collections when a video becomes unavailable
 * Returns statistics about what was updated
 */
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
      // 1. Update main video record
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

      // 2. Update wishlist entries
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

      // 3. Mark audio descriptions as archived
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

      // 4. Clean up user votes for this video
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

      // Add other collections as needed
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

/**
 * Periodic cleanup that checks and updates status of all videos
 * Used as a scheduled task to maintain database consistency
 */
export const checkAndUpdateVideoStatuses = async (): Promise<VideoStatusUpdateStats[]> => {
  const allStats: VideoStatusUpdateStats[] = [];

  try {
    // Get all active videos
    const videos = await MongoVideosModel.find({
      youtube_status: 'available',
    });

    for (const video of videos) {
      try {
        const response = await fetchVideoDetails([video.youtube_id]);

        if (!response?.items?.length) {
          // If video unavailable, update its status across all collections
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
