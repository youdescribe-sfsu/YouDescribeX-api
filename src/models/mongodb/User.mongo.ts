import { Document, Schema } from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';
import { nowUtc } from '../../utils/util';

// Date should be nowUtc

// const moment = require('moment');

// module.exports = {
//   nowUtc: () => {
//     return moment().utc().format('YYYYMMDDHHmmss');
//   },
//   utcToLongInt: (timestampUtc) => {
//     return parseInt(moment(parseInt(timestampUtc)).format("YYYYMMDDHHmmss"));
//   }
// };

interface IUser extends Document {
  admin_level: number;
  email: string;
  created_at: number;
  alias: string;
  google_user_id: string;
  last_login: Number;
  dialects: string;
  name: string;
  opt_in: boolean;
  picture: string;
  policy_review: boolean;
  token: string;
  updated_at: Number;
  user_type: 'volunteer' | 'AI'; // volunteer, admin
}

const UserSchema: Schema = new Schema(
  {
    admin_level: {
      type: Number,
      default: 0,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    created_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
    alias: {
      type: String,
      required: false,
    },
    google_user_id: {
      type: String,
      required: true,
    },
    last_login: {
      type: Number,
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
      type: Number,
      required: true,
      default: () => nowUtc(),
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
