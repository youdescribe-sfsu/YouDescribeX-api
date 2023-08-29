import mongoose, { Schema, Document } from 'mongoose';

export interface IAICaptionRequest extends Document {
  youtube_id: string;
  caption_requests: Schema.Types.ObjectId[];
}

const AICaptionRequestSchema: Schema = new Schema(
  {
    youtube_id: String,
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
