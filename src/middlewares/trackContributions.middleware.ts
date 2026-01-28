import { Request, Response, NextFunction } from 'express';
import { updateContributions } from '../utils/audiodescriptions.util';
import { MongoAudioClipsModel } from '../models/mongodb/init-models.mongo';
import { logger } from '../utils/logger';
import { IUser } from '../models/mongodb/User.mongo';

interface TrackContributionsOptions {
  // Function to extract audioDescriptionId from request
  getAudioDescriptionId?: (req: Request) => Promise<string>;
  // If true, skip tracking (for read operations)
  skip?: boolean;
}

export const trackContributions = (options?: TrackContributionsOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (options?.skip) {
      return next();
    }

    // Store the original json function
    const originalJson = res.json.bind(res);

    // Override res.json to trigger contribution update after successful response
    res.json = function (data: any) {
      // Send response first (non-blocking)
      const result = originalJson(data);

      // Update contributions in background (don't block the response)
      (async () => {
        try {
          let audioDescriptionId: string | null = null;
          const userData = req.user as unknown as IUser;

          if (!userData?._id) {
            logger.debug('[TRACK_CONTRIB] No user found in request, skipping contribution tracking');
            return;
          }

          // Extract audio description ID based on the endpoint
          if (options?.getAudioDescriptionId) {
            audioDescriptionId = await options.getAudioDescriptionId(req);
          } else if (req.params.adId) {
            // For endpoints like /add-new-clip/:adId
            audioDescriptionId = req.params.adId;
          } else if (req.params.clipId) {
            // For endpoints with :clipId, fetch the clip to get audio_description
            const clip = await MongoAudioClipsModel.findById(req.params.clipId);
            if (clip?.audio_description) {
              audioDescriptionId = clip.audio_description.toString();
            }
          } else if (req.body.audioDescriptionId) {
            // For publish/unpublish endpoints
            audioDescriptionId = req.body.audioDescriptionId;
          }

          if (audioDescriptionId) {
            logger.info(`[TRACK_CONTRIB] Updating contributions for AD ${audioDescriptionId} by user ${userData._id}`);
            await updateContributions(audioDescriptionId, userData._id.toString());
            logger.info(`[TRACK_CONTRIB] Successfully updated contributions`);
          } else {
            logger.warn('[TRACK_CONTRIB] Could not determine audio description ID');
          }
        } catch (error) {
          // Don't fail the request if contribution tracking fails
          logger.error('[TRACK_CONTRIB] Failed to update contributions:', error);
        }
      })();

      return result;
    };

    next();
  };
};
