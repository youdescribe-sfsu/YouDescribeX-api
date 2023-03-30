import mongoose, { Document, Schema } from 'mongoose';
import { IAudioDescription } from './AudioDescriptions.mongo';

interface IVideo extends Document {
  audio_descriptions: Array<IAudioDescription['_id']>;
  category: string;
  category_id: number;
  created_at: Date;
  custom_tags: string[];
  description: string;
  duration: number;
  tags: string[];
  title: string;
  updated_at: Date;
  views: number;
  youtube_id: string;
  youtube_status: string;
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
      type: Number,
      required: true,
    },
    created_at: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    custom_tags: [
      {
        type: String,
        required: true,
      },
    ],
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    tags: [
      {
        type: String,
        required: true,
      },
    ],
    title: {
      type: String,
      required: true,
    },
    updated_at: {
      type: Date,
      required: true,
    },
    views: {
      type: Number,
      required: true,
    },
    youtube_id: {
      type: String,
      required: true,
    },
    youtube_status: {
      type: String,
      required: true,
    },
  },
  { collection: 'videos' },
);

export default VideoSchema;
export { IVideo };
