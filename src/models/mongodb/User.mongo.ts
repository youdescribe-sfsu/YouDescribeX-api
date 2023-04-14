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

const UserModel = mongoose.model<IUser>('User', UserSchema);

passport.use(UserModel.createStrategy());
passport.serializeUser((user: any, done) => {
  logger.info('Serializing User: ', user);
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  logger.info('Deserializing User with ID: ', id);
  UserModel.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new Strategy(
    {
      clientID: '1061361249208-9799kv6172rjgmk4gad077639dfrck82.apps.googleusercontent.com',
      clientSecret: 'emqt6gfCSMNlhHfpADZCEgqf',
      callbackURL: PASSPORT_CALLBACK_URL,
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    },
    function verify(accessToken, refreshToken, profile, cb) {
      const payload = profile._json;
      const googleUserId = payload.sub;
      const newToken = crypto
        .createHmac('sha256', CRYPTO_SECRET)
        .update(CRYPTO_SEED + moment().utc().format('YYYYMMDDHHmmss'))
        .digest('hex');
      UserModel.findOneAndUpdate(
        { google_user_id: googleUserId },
        {
          $set: {
            last_login: moment().utc().format('YYYYMMDDHHmmss'),
            updated_at: moment().utc().format('YYYYMMDDHHmmss'),
            token: newToken,
          },
        },
        { new: true },
        (err, user) => {
          if (err) {
            return cb(err, null);
          }
          if (user) {
            return cb(null, user);
          } else {
            const newUser = new UserModel({
              email: payload.email,
              name: payload.name,
              given_name: payload.given_name,
              picture: payload.picture,
              locale: payload.locale,
              google_user_id: googleUserId,
              last_login: moment().utc().format('YYYYMMDDHHmmss'),
              token: newToken,
              opt_in: [],
            });
            newUser.save((errNewUser, newUser) => {
              if (errNewUser) {
                return cb(errNewUser, null);
              }
              if (newUser) {
                return cb(null, newUser);
              } else {
                return cb(err, null);
              }
            });
          }
        },
      );
    },
  ),
);

export default UserSchema;
export { IUser };
