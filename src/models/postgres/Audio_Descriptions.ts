import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { Audio_Clips, Audio_ClipsId } from './Audio_Clips';
import type { Notes, NotesId } from './Notes';
import type { Users, UsersId } from './Users';
import type { Videos, VideosId } from './Videos';

export interface Audio_DescriptionsAttributes {
  ad_id: string;
  is_published: boolean;
  createdAt: Date;
  updatedAt: Date;
  UserUserId?: string;
  VideoVideoId?: string;
}

export type Audio_DescriptionsPk = "ad_id";
export type Audio_DescriptionsId = Audio_Descriptions[Audio_DescriptionsPk];
export type Audio_DescriptionsOptionalAttributes = "createdAt" | "updatedAt" | "UserUserId" | "VideoVideoId";
export type Audio_DescriptionsCreationAttributes = Optional<Audio_DescriptionsAttributes, Audio_DescriptionsOptionalAttributes>;

export class Audio_Descriptions extends Model<Audio_DescriptionsAttributes, Audio_DescriptionsCreationAttributes> implements Audio_DescriptionsAttributes {
  ad_id!: string;
  is_published!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
  UserUserId?: string;
  VideoVideoId?: string;

  // Audio_Descriptions hasMany Audio_Clips via AudioDescriptionAdId
  Audio_Clips!: Audio_Clips[];
  getAudio_Clips!: Sequelize.HasManyGetAssociationsMixin<Audio_Clips>;
  setAudio_Clips!: Sequelize.HasManySetAssociationsMixin<Audio_Clips, Audio_ClipsId>;
  addAudio_Clip!: Sequelize.HasManyAddAssociationMixin<Audio_Clips, Audio_ClipsId>;
  addAudio_Clips!: Sequelize.HasManyAddAssociationsMixin<Audio_Clips, Audio_ClipsId>;
  createAudio_Clip!: Sequelize.HasManyCreateAssociationMixin<Audio_Clips>;
  removeAudio_Clip!: Sequelize.HasManyRemoveAssociationMixin<Audio_Clips, Audio_ClipsId>;
  removeAudio_Clips!: Sequelize.HasManyRemoveAssociationsMixin<Audio_Clips, Audio_ClipsId>;
  hasAudio_Clip!: Sequelize.HasManyHasAssociationMixin<Audio_Clips, Audio_ClipsId>;
  hasAudio_Clips!: Sequelize.HasManyHasAssociationsMixin<Audio_Clips, Audio_ClipsId>;
  countAudio_Clips!: Sequelize.HasManyCountAssociationsMixin;
  // Audio_Descriptions hasMany Notes via AudioDescriptionAdId
  Notes!: Notes[];
  getNotes!: Sequelize.HasManyGetAssociationsMixin<Notes>;
  setNotes!: Sequelize.HasManySetAssociationsMixin<Notes, NotesId>;
  addNote!: Sequelize.HasManyAddAssociationMixin<Notes, NotesId>;
  addNotes!: Sequelize.HasManyAddAssociationsMixin<Notes, NotesId>;
  createNote!: Sequelize.HasManyCreateAssociationMixin<Notes>;
  removeNote!: Sequelize.HasManyRemoveAssociationMixin<Notes, NotesId>;
  removeNotes!: Sequelize.HasManyRemoveAssociationsMixin<Notes, NotesId>;
  hasNote!: Sequelize.HasManyHasAssociationMixin<Notes, NotesId>;
  hasNotes!: Sequelize.HasManyHasAssociationsMixin<Notes, NotesId>;
  countNotes!: Sequelize.HasManyCountAssociationsMixin;
  // Audio_Descriptions belongsTo Users via UserUserId
  UserUser!: Users;
  getUserUser!: Sequelize.BelongsToGetAssociationMixin<Users>;
  setUserUser!: Sequelize.BelongsToSetAssociationMixin<Users, UsersId>;
  createUserUser!: Sequelize.BelongsToCreateAssociationMixin<Users>;
  // Audio_Descriptions belongsTo Videos via VideoVideoId
  VideoVideo!: Videos;
  getVideoVideo!: Sequelize.BelongsToGetAssociationMixin<Videos>;
  setVideoVideo!: Sequelize.BelongsToSetAssociationMixin<Videos, VideosId>;
  createVideoVideo!: Sequelize.BelongsToCreateAssociationMixin<Videos>;

  static initModel(sequelize: Sequelize.Sequelize): typeof Audio_Descriptions {
    return Audio_Descriptions.init({
      ad_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      is_published: {
        type: DataTypes.BOOLEAN,
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
      },
      UserUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'user_id'
        }
      },
      VideoVideoId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Videos',
          key: 'video_id'
        }
      }
    }, {
      sequelize,
      tableName: 'Audio_Descriptions',
      schema: 'public',
      timestamps: true,
      indexes: [
        {
          name: "Audio_Descriptions_pkey",
          unique: true,
          fields: [
            { name: "ad_id" },
          ]
        },
      ]
    });
  }
}
