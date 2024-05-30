import mongoose, { Schema, Document } from 'mongoose';

export interface IAICaptionRequest extends Document {
  youtube_id: string;
  ai_user_id: string;
  status: 'pending' | 'completed';
  caption_requests: Schema.Types.ObjectId[];
}

const AICaptionRequestSchema: Schema = new Schema(
  {
    youtube_id: {
      type: String,
      required: true,
    },
    ai_user_id: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    caption_requests: [
      {
        type: Schema.Types.ObjectId,
        ref: 'users',
        required: true,
      },
    ],
  },
  { collection: 'AICaptionRequests' },
);

export default AICaptionRequestSchema;
