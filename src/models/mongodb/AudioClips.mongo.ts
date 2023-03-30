import mongoose, { Document, Schema } from 'mongoose';

interface ITranscript {
  _id: string;
  sentence: string;
  start_time: number;
  end_time: number;
}

interface IAudioClip extends Document {
  // _id: string;
  audio_description: Schema.Types.ObjectId;
  created_at: Date;
  description_type: string;
  description_text: string;
  duration: number;
  end_time: number;
  file_mime_type: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  label: string;
  playback_type: string;
  start_time: number;
  transcript: ITranscript[];
  updated_at: Date;
  user: string;
  video: string;
}

const AudioClipSchema: Schema = new Schema(
  {
    // _id: {
    //   type: String,
    //   default: () => new mongoose.Types.ObjectId().toString(),
    // },
    audio_description: {
      type: Schema.Types.ObjectId,
      ref: 'AudioDescription',
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
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
      required: true,
    },
    end_time: {
      type: Number,
      required: true,
    },
    file_mime_type: {
      type: String,
      required: true,
    },
    file_name: {
      type: String,
      required: true,
    },
    file_path: {
      type: String,
      required: true,
    },
    file_size_bytes: {
      type: Number,
      required: true,
    },
    label: {
      type: String,
      required: true,
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
  },
  { collection: 'audio_clips' },
);

export default AudioClipSchema;
export { IAudioClip };
