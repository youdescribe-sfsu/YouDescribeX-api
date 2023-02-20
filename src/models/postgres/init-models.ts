import type { Sequelize } from 'sequelize';
import { Audio_Clips as _Audio_Clips } from './Audio_Clips';
import type { Audio_ClipsAttributes, Audio_ClipsCreationAttributes } from './Audio_Clips';
import { Audio_Descriptions as _Audio_Descriptions } from './Audio_Descriptions';
import type { Audio_DescriptionsAttributes, Audio_DescriptionsCreationAttributes } from './Audio_Descriptions';
import { Dialog_Timestamps as _Dialog_Timestamps } from './Dialog_Timestamps';
import type { Dialog_TimestampsAttributes, Dialog_TimestampsCreationAttributes } from './Dialog_Timestamps';
import { Notes as _Notes } from './Notes';
import type { NotesAttributes, NotesCreationAttributes } from './Notes';
import { Participants as _Participants } from './Participants';
import type { ParticipantsAttributes, ParticipantsCreationAttributes } from './Participants';
import { Timings as _Timings } from './Timings';
import type { TimingsAttributes, TimingsCreationAttributes } from './Timings';
import { Users as _Users } from './Users';
import type { UsersAttributes, UsersCreationAttributes } from './Users';
import { Videos as _Videos } from './Videos';
import type { VideosAttributes, VideosCreationAttributes } from './Videos';
import { getPostGresConnection } from '../../databases';

export { _Audio_Clips as Audio_Clips, _Audio_Descriptions as Audio_Descriptions, _Dialog_Timestamps as Dialog_Timestamps, _Notes as Notes, _Participants as Participants, _Timings as Timings, _Users as Users, _Videos as Videos };

export type {
  Audio_ClipsAttributes,
  Audio_ClipsCreationAttributes,
  Audio_DescriptionsAttributes,
  Audio_DescriptionsCreationAttributes,
  Dialog_TimestampsAttributes,
  Dialog_TimestampsCreationAttributes,
  NotesAttributes,
  NotesCreationAttributes,
  ParticipantsAttributes,
  ParticipantsCreationAttributes,
  TimingsAttributes,
  TimingsCreationAttributes,
  UsersAttributes,
  UsersCreationAttributes,
  VideosAttributes,
  VideosCreationAttributes,
};

function initModels(sequelize: Sequelize) {
  // Maintain the Order of the Models
  const Videos = _Videos.initModel(sequelize);
  const Users = _Users.initModel(sequelize);
  const Dialog_Timestamps = _Dialog_Timestamps.initModel(sequelize);
  const Audio_Descriptions = _Audio_Descriptions.initModel(sequelize);
  const Notes = _Notes.initModel(sequelize);
  const Audio_Clips = _Audio_Clips.initModel(sequelize);
  const Participants = _Participants.initModel(sequelize);
  const Timings = _Timings.initModel(sequelize);

  Audio_Clips.belongsTo(Audio_Descriptions, {
    as: 'AudioDescriptionAd',
    foreignKey: 'AudioDescriptionAdId',
  });
  Audio_Descriptions.hasMany(Audio_Clips, {
    as: 'Audio_Clips',
    foreignKey: 'AudioDescriptionAdId',
  });
  Notes.belongsTo(Audio_Descriptions, {
    as: 'AudioDescriptionAd',
    foreignKey: 'AudioDescriptionAdId',
  });
  Audio_Descriptions.hasMany(Notes, {
    as: 'Notes',
    foreignKey: 'AudioDescriptionAdId',
  });
  Timings.belongsTo(Participants, {
    as: 'ParticipantParticipant',
    foreignKey: 'ParticipantParticipantId',
  });
  Participants.hasMany(Timings, {
    as: 'Timings',
    foreignKey: 'ParticipantParticipantId',
  });
  Audio_Descriptions.belongsTo(Users, {
    as: 'UserUser',
    foreignKey: 'UserUserId',
  });
  Users.hasMany(Audio_Descriptions, {
    as: 'Audio_Descriptions',
    foreignKey: 'UserUserId',
  });
  Audio_Descriptions.belongsTo(Videos, {
    as: 'VideoVideo',
    foreignKey: 'VideoVideoId',
  });
  Videos.hasMany(Audio_Descriptions, {
    as: 'Audio_Descriptions',
    foreignKey: 'VideoVideoId',
  });
  Dialog_Timestamps.belongsTo(Videos, {
    as: 'VideoVideo',
    foreignKey: 'VideoVideoId',
  });
  Videos.hasMany(Dialog_Timestamps, {
    as: 'Dialog_Timestamps',
    foreignKey: 'VideoVideoId',
  });

  return {
    PostGres_Audio_Clips: Audio_Clips,
    PostGres_Audio_Descriptions: Audio_Descriptions,
    PostGres_Dialog_Timestamps: Dialog_Timestamps,
    PostGres_Notes: Notes,
    PostGres_Participants: Participants,
    PostGres_Timings: Timings,
    PostGres_Users: Users,
    PostGres_Videos: Videos,
  };
}

export const { PostGres_Audio_Clips, PostGres_Audio_Descriptions, PostGres_Dialog_Timestamps, PostGres_Notes, PostGres_Participants, PostGres_Timings, PostGres_Users, PostGres_Videos } = initModels(getPostGresConnection());
