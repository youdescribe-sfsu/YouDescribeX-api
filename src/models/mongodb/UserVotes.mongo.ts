import { Schema, Document, model, Types } from 'mongoose';

interface IUserVotes extends Document {
  youtube_id: string;
  user: Types.ObjectId;
  updated_at: number;
  created_at: number;
}

const UserVotesSchema = new Schema(
  {
    youtube_id: String,
    user: { type: Types.ObjectId, ref: 'User' },
    updated_at: Number,
    created_at: Number,
  },
  { collection: 'users_votes' },
);

const UserVotesModel = model<IUserVotes>('UserVotes', UserVotesSchema);

export default UserVotesModel;
