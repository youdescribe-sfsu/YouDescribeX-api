import { Schema, Document, model, Types } from 'mongoose';

interface IHistory extends Document {
  user: string;
  visited_videos: string[];
}

const HistorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    visited_videos: [
      {
        type: String,
      },
    ],
  },
  { collection: 'history' },
);

export default HistorySchema;
export { IHistory };
