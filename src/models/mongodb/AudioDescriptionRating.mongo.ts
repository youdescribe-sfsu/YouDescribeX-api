import mongoose, { Document, Schema } from 'mongoose';
import { nowUtc } from '../../utils/util';

interface IAudioDescriptionRating extends Document {
  audio_description: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  rating: number;
  feedback: Array<string>;
  created_at: number;
  updated_at: number;
}

const AudioDescriptionRatingSchema = new Schema<IAudioDescriptionRating>(
  {
    audio_description: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AudioDescription',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: false,
    },
    feedback: [
      {
        type: String,
      },
    ],
    created_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
    updated_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
  },
  { collection: 'audio_descriptions_ratings' },
);

export default AudioDescriptionRatingSchema;
export { IAudioDescriptionRating };
