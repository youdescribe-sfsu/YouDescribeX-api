import mongoose, { Document, Schema } from 'mongoose';
import passport from 'passport';
import passportLocalMongoose from 'passport-local-mongoose';
import { Strategy } from 'passport-google-oauth20';
import crypto from 'crypto';
import moment from 'moment';
import { PASSPORT_CALLBACK_URL, CRYPTO_SECRET, CRYPTO_SEED } from '../../config/index';
import { logger } from '../../utils/logger';

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
      required: false,
    },
    google_user_id: {
      type: String,
      required: false,
    },
    last_login: {
      type: Date,
      required: false,
    },
    dialects: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      required: true,
    },
    opt_in: {
      type: Boolean,
      required: true,
      default: false,
    },
    picture: {
      type: String,
      required: false,
    },
    policy_review: {
      type: Boolean,
      required: false,
    },
    token: {
      type: String,
      required: false,
    },
    updated_at: {
      type: Date,
      required: false,
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

// passportLocalMongoose is a middleware that adds the createStrategy method when plugged in to the user schema.
UserSchema.plugin(passportLocalMongoose);

// const UserModel = mongoose.model<IUser>('User', UserSchema);

export default UserSchema;
export { IUser };
