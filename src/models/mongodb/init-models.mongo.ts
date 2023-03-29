import { model } from 'mongoose';
import AdminSchema, { IAdmin } from './Admin.mongo';
import AudioClipSchema, { IAudioClip } from './AudioClips.mongo';
import AudioDescriptionRatingSchema, { IAudioDescriptionRating } from './AudioDescriptionRating.mongo';
import AudioDescriptionsSchema, { IAudioDescription } from './AudioDescriptions.mongo';
import CategorySchema, { ICategory } from './Category.mongo';
import DialogTimestampsSchema, { DialogTimestamps } from './DialogTimeStamps.mongo';
import LanguageSchema, { ILanguage } from './language.mongo';
import NotesSchema, { INotes } from './Notes.mongo';
import ParticipantsSchema, { ParticipantsAttributes } from './Participants.mongo';
import TimingSchema, { TimingsDocument } from './Timings.mongo';
import TranscriptionSchema, { ITranscription } from './Transcription.mongo';
import UserSchema, { IUser } from './User.mongo';
import UserVotesSchema, { IUserVotes } from './UserVotes.mongo';
import VideoSchema, { IVideo } from './Videos.mongo';
import VisitSchema, { IVisit } from './Visit.mongo';
import WishlistSchema, { IWishList } from './Wishlist.mongo';

function initModels() {
  const Admin = model<IAdmin>('Admin', AdminSchema);
  const UserModel = model<IUser>('User', UserSchema);
  const VideosModel = model<IVideo>('Video', VideoSchema);
  const Dialog_Timestamps = model<DialogTimestamps>('Dialog_Timestamps', DialogTimestampsSchema);
  const AudioDescriptionRating = model<IAudioDescriptionRating>('AudioDescriptionRating', AudioDescriptionRatingSchema);
  const Category = model<ICategory>('Category', CategorySchema);

  const AudioDescriptionModel = model<IAudioDescription>('AudioDescription', AudioDescriptionsSchema);
  const NotesModel = model<INotes>('Notes', NotesSchema);

  const AudioClipModel = model<IAudioClip>('AudioClip', AudioClipSchema);
  const ParticipantsModel = model<ParticipantsAttributes>('Participants', ParticipantsSchema);
  const TimingsModel = model<TimingsDocument>('Timings', TimingSchema);
  const Language = model<ILanguage>('Language', LanguageSchema);
  const Transcription = model<ITranscription>('Transcription', TranscriptionSchema);

  const UserVotesModel = model<IUserVotes>('UserVotes', UserVotesSchema);
  const VisitModel = model<IVisit>('Visit', VisitSchema);
  const WishListModel = model<IWishList>('WishList', WishlistSchema);

  // videosSchema.virtual('AudioDescriptions', {
  //     ref: 'AudioDescriptions',
  //     localField: 'video_id',
  //     foreignField: 'VideoVideoId',
  //     justOne: false,
  // });

  // videosSchema.virtual('DialogTimestamps', {
  //     ref: 'DialogTimestamps',
  //     localField: 'video_id',
  //     foreignField: 'VideoVideoId',
  //     justOne: false,
  // });
  // Dialog_TimestampsSchema.virtual('VideoVideo', {
  //     ref: 'Videos',
  //     localField: 'VideoVideoId',
  //     foreignField: 'video_id',
  //     justOne: true,
  // });
  // Audio_DescriptionsSchema.virtual('UserUser', {
  //     ref: 'Users',
  //     localField: 'UserUserId',
  //     foreignField: 'user_id',
  //     justOne: true,
  // });

  // Audio_DescriptionsSchema.virtual('VideoVideo', {
  //     ref: 'Videos',
  //     localField: 'VideoVideoId',
  //     foreignField: 'video_id',
  //     justOne: true,
  // });

  // audioClipsSchema.virtual('AudioDescriptionAd', {
  //     ref: 'AudioDescriptions',
  //     localField: 'AudioDescriptionAdId',
  //     foreignField: '_id',
  //     justOne: true,
  // });
  // ParticipantsSchema.virtual('Timings', {
  //     ref: 'Timings',
  //     localField: 'participant_id',
  //     foreignField: 'ParticipantParticipantId',
  // });
  // TimingsSchema.virtual('ParticipantParticipant', {
  //     ref: 'Participants',
  //     localField: 'ParticipantParticipantId',
  //     foreignField: '_id',
  //     justOne: true,
  // });

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
  };
}

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
} = initModels();
