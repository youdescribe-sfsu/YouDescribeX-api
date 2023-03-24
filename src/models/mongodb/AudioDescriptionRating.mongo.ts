import mongoose, { Document, Schema } from 'mongoose';

interface IAudioDescriptionRating extends Document {
  audio_description: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  rating: number;
  feedback: string;
  created_at: Date;
  updated_at: Date;
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
      required: true,
    },
    feedback: {
      type: String,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'audio_descriptions_ratings' },
);

const AudioDescriptionRating = mongoose.model<IAudioDescriptionRating>('AudioDescriptionRating', AudioDescriptionRatingSchema);

export default AudioDescriptionRating;
