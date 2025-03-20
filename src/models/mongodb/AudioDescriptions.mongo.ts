import mongoose, { Document, Schema } from 'mongoose';
import { IAudioClip } from './AudioClips.mongo';
import { nowUtc } from '../../utils/util';

interface IAudioDescription extends Document {
  admin_review: boolean;
  audio_clips: Array<IAudioClip['_id']>;
  created_at: Number;
  language: string;
  legacy_notes: string;
  overall_rating_votes_average: number;
  overall_rating_votes_counter: number;
  overall_rating_votes_sum: number;
  status: string;
  updated_at: Number;
  user: string;
  video: string;
  views: number;
  collaborative_editing: boolean;
  contributions?: Record<string, number>;
  prev_audio_description?: string;
  depth?: number;
}

const AudioDescriptionSchema: Schema = new Schema(
  {
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
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
    language: {
      type: String,
      required: true,
      default: 'en',
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
      default: 'draft',
    },
    updated_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
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
    collaborative_editing: {
      type: Boolean,
      default: false,
    },
    contributions: {
      type: Object, // Change from Map
      default: {},
    },
    prev_audio_description: {
      type: Schema.Types.ObjectId,
      ref: 'AudioDescription',
    },
    depth: {
      type: Number,
      default: 1,
    },
  },
  { collection: 'audio_descriptions' },
);

AudioDescriptionSchema.pre('updateOne', function (next) {
  this.set({ updated_at: nowUtc() });
  next();
});

AudioDescriptionSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updated_at: nowUtc() });
  next();
});

export default AudioDescriptionSchema;
export { IAudioDescription };
