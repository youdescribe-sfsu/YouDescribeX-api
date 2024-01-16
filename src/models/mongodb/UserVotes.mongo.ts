import { Schema, Document, model, Types } from 'mongoose';
import { nowUtc } from '../../utils/util';

interface IUserVotes extends Document {
  youtube_id: string;
  user: Types.ObjectId;
  updated_at: number;
  created_at: number;
}

const UserVotesSchema = new Schema(
  {
    youtube_id: {
      type: String,
      required: true,
    },
    user: { type: Types.ObjectId, ref: 'User', required: true },
    updated_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
    created_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
  },
  { collection: 'users_votes' },
);

export default UserVotesSchema;
export { IUserVotes };
