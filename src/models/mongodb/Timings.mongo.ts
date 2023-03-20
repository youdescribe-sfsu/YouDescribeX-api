import { Document, Schema } from 'mongoose';
import { ParticipantsDocument } from './Participants.mongo';

export interface TimingsDocument extends Document {
  total_time: number;
  youtube_video_id: string;
  createdAt: Date;
  updatedAt: Date;
  ParticipantParticipantId?: string;
  ParticipantParticipant: ParticipantsDocument['_id'];
}

const TimingsSchema = new Schema<TimingsDocument>({
  total_time: {
    type: Number,
    required: true,
  },
  youtube_video_id: {
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
  ParticipantParticipantId: {
    type: String,
    ref: 'Participants',
  },
});

export { TimingsSchema };
