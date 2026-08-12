import { MongoAudio_Descriptions_Model, MongoAudioDescriptionRatingModel, MongoUsersModel, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { IAudioDescriptionRating } from '../models/mongodb/AudioDescriptionRating.mongo';
import { nowUtc } from '../utils/util';
import { Types } from 'mongoose';
import sendEmail from '../utils/emailService';
import { logger } from '../utils/logger';

export interface IUserRating {
  rating: number | null;
  enjoymentRating: number | null;
  comment: string;
}

/** The description's rating aggregate after a vote, returned so the client can display it verbatim. */
export interface IOverallRating {
  overall_rating_votes_sum: number;
  overall_rating_votes_counter: number;
  overall_rating_votes_average: number;
}

export interface IAddRatingResult {
  rating: IAudioDescriptionRating;
  overallRating: IOverallRating | null;
}

/**
 * Lowest score on each dimension that gets feedback emailed to the description
 * owner. Lower ratings are still stored and still count towards the overall
 * average — only the notification to the describer is withheld.
 */
export const OWNER_NOTIFICATION_MIN_RATING = 3;

/**
 * Both dimensions have to clear the bar independently, so feedback that was
 * positive on one axis but poor on the other is not passed on.
 *
 * `enjoymentRating` is optional on the payload; when a client does not send one
 * there is no second score to compare, so the comprehension rating decides.
 */
export const shouldNotifyOwnerOfRating = (rating: number, enjoymentRating?: number | null): boolean => {
  if (rating < OWNER_NOTIFICATION_MIN_RATING) return false;
  if (enjoymentRating === undefined || enjoymentRating === null) return true;
  return enjoymentRating >= OWNER_NOTIFICATION_MIN_RATING;
};

/**
 * The single star score a rating contributes: the mean of the comprehension and
 * enjoyment answers, so the star display reflects both questions equally.
 *
 * Can be a half value (a 5 and a 4 average to 4.5); the stored average is kept
 * unrounded and the UI rounds it for display. A rating with no enjoyment answer
 * contributes its comprehension score alone.
 */
export const combinedRatingScore = (rating: number, enjoymentRating?: number | null): number => {
  if (enjoymentRating === undefined || enjoymentRating === null) return rating;
  return (rating + enjoymentRating) / 2;
};

class AudioDescriptionRatingService {
  public async getUserRating(userId: string, audioDescriptionId: string): Promise<IUserRating | null> {
    try {
      const rating = await MongoAudioDescriptionRatingModel.findOne({
        audio_description: new Types.ObjectId(audioDescriptionId),
        user: new Types.ObjectId(userId),
      });

      if (!rating) {
        return null;
      }

      return {
        rating: rating.rating ?? null,
        enjoymentRating: rating.enjoyment_rating ?? null,
        comment: rating.comment ?? '',
      };
    } catch (error) {
      console.error(`Error fetching user rating for user ${userId} on audio description ${audioDescriptionId}:`, error);
      throw error;
    }
  }

  /**
   * `previousScore`/`newScore` are combined comprehension+enjoyment scores (see
   * `combinedRatingScore`), not raw comprehension ratings. A `previousScore` of
   * 0 means this user had not rated before, so the vote counter goes up.
   */
  private async updateOverallRating(audioDescriptionId: string, previousScore: number, newScore: number): Promise<IOverallRating | null> {
    try {
      const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);

      if (!audioDescription) {
        console.error(`Audio description not found for id: ${audioDescriptionId}`);
        return null;
      }

      const updatedData = {
        overall_rating_votes_sum: (audioDescription.overall_rating_votes_sum || 0) - previousScore + newScore,
        overall_rating_votes_counter:
          previousScore === 0 ? (audioDescription.overall_rating_votes_counter || 0) + 1 : audioDescription.overall_rating_votes_counter,
        overall_rating_votes_average: 0,
        updated_at: nowUtc(),
      };

      // Kept unrounded: combined scores land on halves, and flooring 4.5 to 4
      // would systematically under-report the star average. The UI rounds it.
      updatedData.overall_rating_votes_average = updatedData.overall_rating_votes_sum / (updatedData.overall_rating_votes_counter || 1);

      await MongoAudio_Descriptions_Model.updateOne({ _id: audioDescriptionId }, updatedData);

      return {
        overall_rating_votes_sum: updatedData.overall_rating_votes_sum,
        overall_rating_votes_counter: updatedData.overall_rating_votes_counter,
        overall_rating_votes_average: updatedData.overall_rating_votes_average,
      };
    } catch (error) {
      console.error(`Error updating overall rating for audio description ${audioDescriptionId}:`, error);
      throw error;
    }
  }

  public async addRating(
    userId: string,
    audioDescriptionId: string,
    rating: number,
    feedback: string[],
    enjoymentRating?: number,
    comment?: string,
  ): Promise<IAddRatingResult> {
    try {
      const existingRating = await MongoAudioDescriptionRatingModel.findOne({
        audio_description: new Types.ObjectId(audioDescriptionId),
        user: new Types.ObjectId(userId),
      });

      let result: IAudioDescriptionRating;
      let overallRating: IOverallRating | null;

      if (existingRating) {
        const updateFields: Record<string, unknown> = {
          rating: rating,
          feedback: feedback,
          updated_at: nowUtc(),
        };
        if (enjoymentRating !== undefined) {
          updateFields.enjoyment_rating = enjoymentRating;
        }
        if (comment !== undefined) {
          updateFields.comment = comment;
        }

        const updatedRating = await MongoAudioDescriptionRatingModel.findOneAndUpdate({ _id: existingRating._id }, updateFields, { new: true });

        if (!updatedRating) {
          throw new Error('Failed to update rating');
        }

        // Back out this user's previous combined score, not just its
        // comprehension half, or the running sum drifts on every re-rating.
        overallRating = await this.updateOverallRating(
          audioDescriptionId,
          combinedRatingScore(existingRating.rating, existingRating.enjoyment_rating),
          combinedRatingScore(rating, enjoymentRating),
        );
        result = updatedRating;
      } else {
        const newRating = new MongoAudioDescriptionRatingModel({
          user: new Types.ObjectId(userId),
          audio_description: new Types.ObjectId(audioDescriptionId),
          rating: rating,
          enjoyment_rating: enjoymentRating,
          comment: comment,
          feedback: feedback,
          created_at: nowUtc(),
          updated_at: nowUtc(),
        });

        const createdRating = await newRating.save();
        overallRating = await this.updateOverallRating(audioDescriptionId, 0, combinedRatingScore(rating, enjoymentRating));
        result = createdRating;
      }

      await this.notifyOwnerOfFeedback(userId, audioDescriptionId, rating, enjoymentRating);
      return { rating: result, overallRating };
    } catch (error) {
      console.error(`Error adding/updating rating for user ${userId} on audio description ${audioDescriptionId}:`, error);
      throw error;
    }
  }

  private async notifyOwnerOfFeedback(raterId: string, audioDescriptionId: string, rating: number, enjoymentRating?: number): Promise<void> {
    try {
      // Checked before any lookups so a low rating costs nothing extra.
      if (!shouldNotifyOwnerOfRating(rating, enjoymentRating)) {
        logger.info(
          `Skipping owner notification for audio description ${audioDescriptionId}: rating ${rating}, enjoyment ${enjoymentRating} below the ${OWNER_NOTIFICATION_MIN_RATING} threshold`,
        );
        return;
      }

      const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);
      if (!audioDescription || audioDescription.user.toString() === raterId) return;

      const owner = await MongoUsersModel.findOne({ _id: audioDescription.user, opt_in_ai_feedback: true });
      if (!owner || !owner.email) return;

      const video = await MongoVideosModel.findById(audioDescription.video);
      const videoTitle = video ? video.title : 'your video';

      await sendEmail(
        owner.email,
        `You've received feedback on your audio description`,
        this.getFeedbackNotificationEmailBody(owner.name, videoTitle, rating, enjoymentRating, video?.youtube_id, audioDescriptionId),
      );
    } catch (error: any) {
      logger.error(`Error notifying owner of feedback on audio description ${audioDescriptionId}: ${error.message}`);
    }
  }

  private getFeedbackNotificationEmailBody(
    userName: string,
    videoTitle: string,
    rating: number,
    enjoymentRating: number | undefined,
    youtube_id: string | undefined,
    audioDescriptionId: string,
  ) {
    const ydx_app_host = process.env.FRONTEND_URL || 'http://localhost:3000';
    const previewURL = youtube_id ? `${ydx_app_host}/video/${youtube_id}?ad=${audioDescriptionId}` : undefined;
    // The rater's free-text comment is deliberately not included; it stays on
    // the site rather than being pushed into the describer's inbox.
    return `
      Dear ${userName},

      Someone has left feedback on your audio description for "${videoTitle}".

      Rating: ${rating} / 5
      ${enjoymentRating !== undefined ? `Enjoyment: ${enjoymentRating} / 5` : ''}
      ${previewURL ? `Check out the video and its rating here: ${previewURL}` : ''}

      Thank you for contributing to the YouDescribe community.

      Best regards,
      The YouDescribe Team
  `;
  }
}

export default AudioDescriptionRatingService;
