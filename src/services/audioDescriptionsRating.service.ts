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

  private async updateOverallRating(audioDescriptionId: string, previousRating: number, newRating: number) {
    try {
      const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);

      if (!audioDescription) {
        console.error(`Audio description not found for id: ${audioDescriptionId}`);
        return;
      }

      const updatedData = {
        overall_rating_votes_sum: (audioDescription.overall_rating_votes_sum || 0) - previousRating + newRating,
        overall_rating_votes_counter:
          previousRating === 0 ? (audioDescription.overall_rating_votes_counter || 0) + 1 : audioDescription.overall_rating_votes_counter,
        overall_rating_votes_average: 0,
        updated_at: nowUtc(),
      };

      updatedData.overall_rating_votes_average = Math.floor(updatedData.overall_rating_votes_sum / (updatedData.overall_rating_votes_counter || 1));

      await MongoAudio_Descriptions_Model.updateOne({ _id: audioDescriptionId }, updatedData);
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
  ): Promise<IAudioDescriptionRating> {
    try {
      const existingRating = await MongoAudioDescriptionRatingModel.findOne({
        audio_description: new Types.ObjectId(audioDescriptionId),
        user: new Types.ObjectId(userId),
      });

      let result: IAudioDescriptionRating;

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

        await this.updateOverallRating(audioDescriptionId, existingRating.rating, rating);
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
        await this.updateOverallRating(audioDescriptionId, 0, rating);
        result = createdRating;
      }

      await this.notifyOwnerOfFeedback(userId, audioDescriptionId, rating, feedback);
      return result;
    } catch (error) {
      console.error(`Error adding/updating rating for user ${userId} on audio description ${audioDescriptionId}:`, error);
      throw error;
    }
  }

  private async notifyOwnerOfFeedback(raterId: string, audioDescriptionId: string, rating: number, feedback: string[]): Promise<void> {
    try {
      const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);
      if (!audioDescription || audioDescription.user.toString() === raterId) return;

      const owner = await MongoUsersModel.findOne({ _id: audioDescription.user, opt_in_ai_feedback: true });
      if (!owner || !owner.email) return;

      const video = await MongoVideosModel.findById(audioDescription.video);
      const videoTitle = video ? video.title : 'your video';

      await sendEmail(
        owner.email,
        `You've received feedback on your audio description`,
        this.getFeedbackNotificationEmailBody(owner.name, videoTitle, rating, feedback, video?.youtube_id, audioDescriptionId),
      );
    } catch (error: any) {
      logger.error(`Error notifying owner of feedback on audio description ${audioDescriptionId}: ${error.message}`);
    }
  }

  private getFeedbackNotificationEmailBody(
    userName: string,
    videoTitle: string,
    rating: number,
    feedback: string[],
    youtube_id: string | undefined,
    audioDescriptionId: string,
  ) {
    const ydx_app_host = process.env.FRONTEND_URL || 'http://localhost:3000';
    const previewURL = youtube_id ? `${ydx_app_host}/video/${youtube_id}?ad=${audioDescriptionId}` : undefined;
    return `
      Dear ${userName},

      Someone has left feedback on your audio description for "${videoTitle}".

      Rating: ${rating} / 5
      ${feedback.length ? `Feedback: ${feedback.join(', ')}` : ''}
      ${previewURL ? `Check out the video and its rating here: ${previewURL}` : ''}

      Thank you for contributing to the YouDescribe community.

      Best regards,
      The YouDescribe Team
  `;
  }
}

export default AudioDescriptionRatingService;
