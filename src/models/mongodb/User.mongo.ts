import mongoose, { Document, Schema } from 'mongoose';

interface IUser extends Document {
  admin_level: number;
  email: string;
  alias: string;
  google_user_id: string;
  last_login: Date;
  dialects: string;
  name: string;
  opt_in: boolean;
  picture: string;
  policy_review: boolean;
  token: string;
  updated_at: Date;
  user_type: string; // volunteer, admin
}

const UserSchema: Schema = new Schema(
  {
    admin_level: {
      type: Number,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    alias: {
      type: String,
      required: true,
    },
    google_user_id: {
      type: String,
      required: true,
    },
    last_login: {
      type: Date,
      required: true,
    },
    dialects: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    opt_in: {
      type: Boolean,
      required: true,
    },
    picture: {
      type: String,
      required: true,
    },
    policy_review: {
      type: Boolean,
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    updated_at: {
      type: Date,
      required: true,
    },
    user_type: {
      type: String,
      required: true,
    },
  },
  {
    collection: 'users',
  },
);

// const UserModel = mongoose.model<IUser>('User', UserSchema);

export default UserSchema;
export { IUser };
