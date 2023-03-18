import { model } from 'mongoose';
import { AudioClipsDocument, AudioClipsModel as _AudioClipsModel, audioClipsSchema } from './AudioClips.mongo';
import { Audio_DescriptionsDocument, Audio_DescriptionsModel as _Audio_DescriptionsModel, Audio_DescriptionsSchema } from './AudioDescriptions.mongo';
import { Dialog_TimestampsDocument, Dialog_TimestampsModel as _Dialog_TimestampsModel, Dialog_TimestampsSchema } from './DialogTimeStamps.mongo';
import { NotesDocument, NotesSchema } from './Notes.mongo';
import { ParticipantsDocument, ParticipantsSchema } from './Participants.mongo';
import { TimingsDocument, TimingsSchema } from './Timings.mongo';
import { UsersDocument, UsersSchema } from './User.mongo';
import { VideosDocument, VideosModel as _VideosModel, videosSchema } from './Videos.mongo';

function initModels() {
  const VideosModel = model<VideosDocument, _VideosModel>('Videos', videosSchema);
  const UsersModel = model<UsersDocument>('Users', UsersSchema);
  const Dialog_Timestamps_Model = model<Dialog_TimestampsDocument, _Dialog_TimestampsModel>('Dialog_Timestamps', Dialog_TimestampsSchema, 'Dialog_Timestamps');
  const Audio_Descriptions = model<Audio_DescriptionsDocument, _Audio_DescriptionsModel>('Audio_Descriptions', Audio_DescriptionsSchema);
  const NotesModel = model<NotesDocument>('Notes', NotesSchema);
  const AudioClipsModel = model<AudioClipsDocument, _AudioClipsModel>('AudioClips', audioClipsSchema);
  const ParticipantsModel = model<ParticipantsDocument>('Participants', ParticipantsSchema);
  const TimingsModel = model<TimingsDocument>('Timings', TimingsSchema);
  videosSchema.virtual('AudioDescriptions', {
    ref: 'AudioDescriptions',
    localField: 'video_id',
    foreignField: 'VideoVideoId',
    justOne: false,
  });

  videosSchema.virtual('DialogTimestamps', {
    ref: 'DialogTimestamps',
    localField: 'video_id',
    foreignField: 'VideoVideoId',
    justOne: false,
  });
  Dialog_TimestampsSchema.virtual('VideoVideo', {
    ref: 'Videos',
    localField: 'VideoVideoId',
    foreignField: 'video_id',
    justOne: true,
  });
  Audio_DescriptionsSchema.virtual('UserUser', {
    ref: 'Users',
    localField: 'UserUserId',
    foreignField: 'user_id',
    justOne: true,
  });

  Audio_DescriptionsSchema.virtual('VideoVideo', {
    ref: 'Videos',
    localField: 'VideoVideoId',
    foreignField: 'video_id',
    justOne: true,
  });

  audioClipsSchema.virtual('AudioDescriptionAd', {
    ref: 'AudioDescriptions',
    localField: 'AudioDescriptionAdId',
    foreignField: '_id',
    justOne: true,
  });
  ParticipantsSchema.virtual('Timings', {
    ref: 'Timings',
    localField: 'participant_id',
    foreignField: 'ParticipantParticipantId',
  });
  TimingsSchema.virtual('ParticipantParticipant', {
    ref: 'Participants',
    localField: 'ParticipantParticipantId',
    foreignField: '_id',
    justOne: true,
  });

  return {
    MongoVideosModel: VideosModel,
    MongoUsersModel: UsersModel,
    MongoDialog_Timestamps_Model: Dialog_Timestamps_Model,
    MongoAudio_Descriptions_Model: Audio_Descriptions,
    MongoNotesModel: NotesModel,
    MongoAudioClipsModel: AudioClipsModel,
    MongoParticipantsModel: ParticipantsModel,
    MongoTimingsModel: TimingsModel,
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
} = initModels();
