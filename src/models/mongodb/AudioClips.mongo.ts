import mongoose, { Document, Schema } from 'mongoose';
import { nowUtc } from '../../utils/util';

interface ITranscript {
  _id: string;
  sentence: string;
  start_time: number;
  end_time: number;
}

interface IAudioClip extends Document {
  // _id: string;
  audio_description: Schema.Types.ObjectId;
  created_at: number;
  description_type: 'Visual' | 'Text on Screen';
  description_text: string;
  duration: number;
  end_time: number;
  file_mime_type: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  is_recorded: boolean;
  label: string;
  playback_type: string;
  start_time: number;
  transcript: ITranscript[];
  updated_at: number;
  user: string;
  video: string;
}

const AudioClipSchema: Schema = new Schema(
  {
    audio_description: {
      type: Schema.Types.ObjectId,
      ref: 'AudioDescription',
      required: true,
    },
    created_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
    description_type: {
      type: String,
      required: true,
    },
    description_text: {
      type: String,
    },
    duration: {
      type: Number,
      required: false,
    },
    end_time: {
      type: Number,
      required: false,
    },
    file_mime_type: {
      type: String,
      required: false,
    },
    file_name: {
      type: String,
      required: false,
    },
    file_path: {
      type: String,
      required: false,
    },
    file_size_bytes: {
      type: Number,
      required: false,
    },
    is_recorded: {
      type: Boolean,
      required: true,
      default: false,
    },
    label: {
      type: String,
      required: false,
    },
    playback_type: {
      type: String,
      required: true,
    },
    start_time: {
      type: Number,
      required: true,
    },
    transcript: [
      {
        _id: {
          type: String,
          default: () => new mongoose.Types.ObjectId().toString(),
        },
        sentence: {
          type: String,
          required: true,
        },
        start_time: {
          type: Number,
          required: true,
        },
        end_time: {
          type: Number,
          required: true,
        },
      },
    ],
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
  },
  { collection: 'audio_clips' },
);

export default AudioClipSchema;
export { IAudioClip };
