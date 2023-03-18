import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { TimingsDocument } from './Timings.mongo';

export interface ParticipantsAttributes {
  participant_id: string;
  participant_name: string;
  participant_email?: string;
  youtube_video_id_with_AI: string;
  youtube_video_id_without_AI: string;
  user_id_with_AI: string;
  user_id_without_AI: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ParticipantsDocument = Document &
  ParticipantsAttributes & {
    Timings: TimingsDocument[];
  };

const ParticipantsSchema = new Schema(
  {
    participant_id: {
      type: String,
      default: uuidv4,
      required: true,
      unique: true,
    },
    participant_name: {
      type: String,
      required: true,
    },
    participant_email: {
      type: String,
    },
    youtube_video_id_with_AI: {
      type: String,
      required: true,
    },
    youtube_video_id_without_AI: {
      type: String,
      required: true,
    },
    user_id_with_AI: {
      type: String,
      required: true,
    },
    user_id_without_AI: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'Participants',
    timestamps: true,
  },
);

export { ParticipantsSchema };
