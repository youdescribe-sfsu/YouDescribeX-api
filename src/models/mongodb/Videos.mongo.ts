import mongoose, { Document, Schema } from 'mongoose';
import { IAudioDescription } from './AudioDescriptions.mongo';

interface IVideo extends Document {
  audio_descriptions: Array<IAudioDescription['_id']>;
  category: string;
  category_id: number;
  created_at: Date;
  description: string;
  duration: number;
  tags: string[];
  title: string;
  updated_at: Date;
  views: number;
  youtube_id: string;
  youtube_status: 'available' | 'unavailable';
  youtube_metadata: any;
  cached_at: number;
}

const VideoSchema: Schema = new Schema(
  {
    audio_descriptions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'AudioDescription',
      },
    ],
    category: {
      type: String,
      required: true,
    },
    category_id: {
      type: String,
      required: true,
    },
    created_at: {
      type: Number,
      required: true,
      // default: () =>nowUtc(),
    },
    description: {
      type: String,
      required: false,
    },
    duration: {
      type: Number,
      required: true,
    },
    tags: [
      {
        type: String,
        required: false,
      },
    ],
    title: {
      type: String,
      required: true,
    },
    updated_at: {
      type: Number,
      required: true,
    },
    views: {
      type: Number,
      required: false,
    },
    youtube_id: {
      type: String,
      required: true,
    },
    youtube_status: {
      type: String,
      required: true,
    },
    youtube_metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
    cached_at: {
      type: Number,
      required: false,
    },
  },
  { collection: 'videos' },
);

export default VideoSchema;
export { IVideo };
