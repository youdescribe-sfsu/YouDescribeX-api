import mongoose, { Document, Schema } from 'mongoose';
import { IAudioClip } from './AudioClips.mongo';

interface IAudioDescription extends Document {
  admin_review: boolean;
  audio_clips: Array<IAudioClip['_id']>;
  created_at: Date;
  language: string;
  legacy_notes: string;
  overall_rating_votes_average: number;
  overall_rating_votes_counter: number;
  overall_rating_votes_sum: number;
  status: string;
  updated_at: Date;
  user: string;
  video: string;
  views: number;
}

const AudioDescriptionSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    admin_review: {
      type: Boolean,
      default: false,
    },
    audio_clips: [
      {
        type: Schema.Types.ObjectId,
        ref: 'AudioClip',
      },
    ],
    created_at: {
      type: Date,
      default: Date.now,
    },
    language: {
      type: String,
      required: true,
    },
    legacy_notes: {
      type: String,
    },
    overall_rating_votes_average: {
      type: Number,
      default: 0,
    },
    overall_rating_votes_counter: {
      type: Number,
      default: 0,
    },
    overall_rating_votes_sum: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      required: true,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  { collection: 'audio_descriptions' },
);

export default AudioDescriptionSchema;
export { IAudioDescription };
