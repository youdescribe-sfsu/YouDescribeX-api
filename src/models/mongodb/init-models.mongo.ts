import { model } from 'mongoose';
import { logger } from '../../utils/logger';
import AdminSchema, { IAdmin } from './Admin.mongo';
import AudioClipSchema, { IAudioClip } from './AudioClips.mongo';
import AudioDescriptionRatingSchema, { IAudioDescriptionRating } from './AudioDescriptionRating.mongo';
import AudioDescriptionsSchema, { IAudioDescription } from './AudioDescriptions.mongo';
import CategorySchema, { ICategory } from './Category.mongo';
import DialogTimestampsSchema, { DialogTimestamps } from './DialogTimeStamps.mongo';
import LanguageSchema, { ILanguage } from './Language.mongo';
import NotesSchema, { INotes } from './Notes.mongo';
import ParticipantsSchema, { ParticipantsAttributes } from './Participants.mongo';
import TimingSchema, { TimingsDocument } from './Timings.mongo';
import TranscriptionSchema, { ITranscription } from './Transcription.mongo';
import UserSchema, { IUser } from './User.mongo';
import UserVotesSchema, { IUserVotes } from './UserVotes.mongo';
import VideoSchema, { IVideo } from './Videos.mongo';
import VisitSchema, { IVisit } from './Visit.mongo';
import WishlistSchema, { IWishList } from './Wishlist.mongo';
import { Strategy } from 'passport-google-oauth20';
import crypto from 'crypto';
import moment from 'moment';
import { PASSPORT_CALLBACK_URL, CRYPTO_SECRET, CRYPTO_SEED, PORT } from '../../config/index';
import passport from 'passport';
import axios from 'axios';
import AICaptionRequestSchema, { IAICaptionRequest } from './AICaptionRequests.mongo';

function initModels() {
  const VideosModel = model<IVideo>('Video', VideoSchema);
  const UserModel = model<IUser>('User', UserSchema);
  const Dialog_Timestamps = model<DialogTimestamps>('Dialog_Timestamps', DialogTimestampsSchema);
  const AudioDescriptionModel = model<IAudioDescription>('AudioDescription', AudioDescriptionsSchema);
  const NotesModel = model<INotes>('Notes', NotesSchema);
  const AudioClipModel = model<IAudioClip>('AudioClip', AudioClipSchema);
  const ParticipantsModel = model<ParticipantsAttributes>('Participants', ParticipantsSchema);
  const TimingsModel = model<TimingsDocument>('Timings', TimingSchema);
  const Admin = model<IAdmin>('Admin', AdminSchema);
  const AudioDescriptionRating = model<IAudioDescriptionRating>('AudioDescriptionRating', AudioDescriptionRatingSchema);
  const Category = model<ICategory>('Category', CategorySchema);
  const Language = model<ILanguage>('Language', LanguageSchema);
  const Transcription = model<ITranscription>('Transcription', TranscriptionSchema);

  const UserVotesModel = model<IUserVotes>('UserVotes', UserVotesSchema);
  const VisitModel = model<IVisit>('Visit', VisitSchema);
  const WishListModel = model<IWishList>('WishList', WishlistSchema);
  const AICaptionRequestModel = model<IAICaptionRequest>('AICaptionRequest', AICaptionRequestSchema);

  return {
    MongoVideosModel: VideosModel,
    MongoUsersModel: UserModel,
    MongoDialog_Timestamps_Model: Dialog_Timestamps,
    MongoAudio_Descriptions_Model: AudioDescriptionModel,
    MongoNotesModel: NotesModel,
    MongoAudioClipsModel: AudioClipModel,
    MongoParticipantsModel: ParticipantsModel,
    MongoTimingsModel: TimingsModel,
    MongoLanguageModel: Language,
    MongoTranscriptionModel: Transcription,
    MongoUserVotesModel: UserVotesModel,
    MongoVisitModel: VisitModel,
    MongoWishListModel: WishListModel,
    MongoCategoryModel: Category,
    MongoAudioDescriptionRatingModel: AudioDescriptionRating,
    MongoAdminModel: Admin,
    MongoAICaptionRequestModel: AICaptionRequestModel,
  };
}

export const initPassport = () => {
  // const userService = new UserService();
  passport.use(MongoUsersModel.createStrategy());
  passport.serializeUser((user: any, done) => {
    console.log('serialized user');
    done(null, user._id);
  });
  passport.deserializeUser((id, done) => {
    MongoUsersModel.findById(id, function (err, user) {
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
      async function verify(accessToken, refreshToken, profile, cb) {
        const payload = profile._json;
        logger.info('payload: ', payload);
        const googleUserId = payload.sub;
        const newToken = crypto
          .createHmac('sha256', CRYPTO_SECRET)
          .update(CRYPTO_SEED + moment().utc().format('YYYYMMDDHHmmss'))
          .digest('hex');

        try {
          const newUser = await axios.post(`http://localhost:${PORT}/api/create-user-links/create-user`, {
            email: payload.email,
            name: payload.name,
            given_name: payload.given_name,
            picture: payload.picture,
            locale: payload.locale,
            google_user_id: googleUserId,
            token: newToken,
            opt_in: false,
            admin_level: 0,
            user_type: 'Volunteer',
          });
          return cb(null, newUser.data);
        } catch (error) {
          return cb(error, null);
        }
      },
    ),
  );
};

export const {
  MongoVideosModel,
  MongoUsersModel,
  MongoDialog_Timestamps_Model,
  MongoAudio_Descriptions_Model,
  MongoNotesModel,
  MongoTimingsModel,
  MongoAudioClipsModel,
  MongoParticipantsModel,
  MongoLanguageModel,
  MongoTranscriptionModel,
  MongoUserVotesModel,
  MongoVisitModel,
  MongoWishListModel,
  MongoCategoryModel,
  MongoAudioDescriptionRatingModel,
  MongoAdminModel,
  MongoAICaptionRequestModel,
} = initModels();
