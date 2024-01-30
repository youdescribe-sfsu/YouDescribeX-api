import { MongoAudio_Descriptions_Model, MongoAudioDescriptionRatingModel, MongoUsersModel } from '../models/mongodb/init-models.mongo';
import { IAudioDescriptionRating } from '../models/mongodb/AudioDescriptionRating.mongo';
import { nowUtc } from '../utils/util';

class AudioDescriptionRatingService {
  private async updateOverallRating(audioDescriptionId: string, previousRating: number, newRating: number) {
    const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);

    if (audioDescription) {
      const updatedData = {
        ...audioDescription,
        updated_at: nowUtc(),
      };

      updatedData.overall_rating_votes_sum = (updatedData.overall_rating_votes_sum || 0) - previousRating + newRating;

      if (previousRating === 0) {
        updatedData.overall_rating_votes_counter = (updatedData.overall_rating_votes_counter || 0) + 1;
      }

      updatedData.overall_rating_votes_average = Math.floor(updatedData.overall_rating_votes_sum / (updatedData.overall_rating_votes_counter || 1));

      await audioDescription.updateOne({ _id: audioDescriptionId }, updatedData);
    }
  }
  public async addRating(userId: string, audioDescriptionId: string, rating: number, feedback: []): Promise<IAudioDescriptionRating> {
    const existingRating = await MongoAudioDescriptionRatingModel.findOne({
      audio_description: audioDescriptionId,
      user: userId,
    });

    console.log(existingRating);

    try {
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

        await this.updateOverallRating(audioDescriptionId, existingRating.rating, rating);
        return updatedRating;
      } else {
        const newRating = new MongoAudioDescriptionRatingModel({
          user: userId,
          audio_description: audioDescriptionId,
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
      throw error;
    }
  }
}

export default AudioDescriptionRatingService;
