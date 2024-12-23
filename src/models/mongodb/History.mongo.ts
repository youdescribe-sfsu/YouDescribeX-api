import { Schema, Document, Types } from 'mongoose';

interface IHistoryEntry {
  youtube_id: string;
  visited_at: Date;
}

interface IHistory extends Document {
  user: Types.ObjectId;
  visited_videos: IHistoryEntry[];
}

const HistoryEntrySchema = new Schema(
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
  { _id: false },
);

const HistorySchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    visited_videos: [HistoryEntrySchema],
  },
  {
    collection: 'history',
    timestamps: true,
  },
);

// Index for faster queries
HistorySchema.index({ user: 1, 'visited_videos.visited_at': -1 });

// Add validation to ensure youtube_id is always present
HistorySchema.path('visited_videos').validate(function (videos: IHistoryEntry[]) {
  if (!videos) return false;
  return videos.every(video => video && video.youtube_id);
}, 'YouTube ID is required for all video entries');

export default HistorySchema;
export { IHistory, IHistoryEntry };
