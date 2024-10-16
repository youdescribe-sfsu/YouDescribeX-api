import { MongoAudio_Descriptions_Model, MongoAudioDescriptionRatingModel } from '../models/mongodb/init-models.mongo';
import { IAudioDescriptionRating } from '../models/mongodb/AudioDescriptionRating.mongo';
import { nowUtc } from '../utils/util';
import { Types } from 'mongoose';

class AudioDescriptionRatingService {
  public async getUserRating(userId: string, audioDescriptionId: string): Promise<number | null> {
    try {
      const rating = await MongoAudioDescriptionRatingModel.findOne({
        audio_description: new Types.ObjectId(audioDescriptionId),
        user: new Types.ObjectId(userId),
      });

      return rating ? rating.rating : null;
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

  public async addRating(userId: string, audioDescriptionId: string, rating: number, feedback: string[]): Promise<IAudioDescriptionRating> {
    try {
      const existingRating = await MongoAudioDescriptionRatingModel.findOne({
        audio_description: new Types.ObjectId(audioDescriptionId),
        user: new Types.ObjectId(userId),
      });

      if (existingRating) {
        const updatedRating = await MongoAudioDescriptionRatingModel.findOneAndUpdate(
          { _id: existingRating._id },
          {
            rating: rating,
            feedback: feedback,
            updated_at: nowUtc(),
          },
          { new: true },
        );

        if (!updatedRating) {
          throw new Error('Failed to update rating');
        }

        await this.updateOverallRating(audioDescriptionId, existingRating.rating, rating);
        return updatedRating;
      } else {
        const newRating = new MongoAudioDescriptionRatingModel({
          user: new Types.ObjectId(userId),
          audio_description: new Types.ObjectId(audioDescriptionId),
          rating: rating,
          feedback: feedback,
          created_at: nowUtc(),
          updated_at: nowUtc(),
        });

        const createdRating = await newRating.save();
        await this.updateOverallRating(audioDescriptionId, 0, rating);
        return createdRating;
      }
    } catch (error) {
      console.error(`Error adding/updating rating for user ${userId} on audio description ${audioDescriptionId}:`, error);
      throw error;
    }
  }
}

export default AudioDescriptionRatingService;
