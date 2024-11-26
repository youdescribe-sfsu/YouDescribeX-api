// History.mongo.ts
import { Schema, Document, Types } from 'mongoose';

interface IHistoryEntry {
  youtube_id: string;
  visited_at: Date;
}

interface IHistory extends Document {
  user: Types.ObjectId;
  visited_videos: IHistoryEntry[];
}

const HistorySchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    visited_videos: [
      {
        youtube_id: {
          type: String,
          required: true,
        },
        visited_at: {
          type: Date,
          default: Date.now,
          required: true,
        },
      },
    ],
  },
  {
    collection: 'history',
    timestamps: true,
  },
);

// Index for faster queries by user and visit date
HistorySchema.index({ user: 1, 'visited_videos.visited_at': -1 });

export default HistorySchema;
export { IHistory, IHistoryEntry };
