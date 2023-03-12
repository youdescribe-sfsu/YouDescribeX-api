import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { Audio_Descriptions, Audio_DescriptionsId } from './Audio_Descriptions';
import type { Dialog_Timestamps, Dialog_TimestampsId } from './Dialog_Timestamps';
import type { IVideos } from '../../interfaces/videos.interface';

export type VideosPk = 'video_id';
export type VideosId = Videos[VideosPk];
export type VideosOptionalAttributes = 'createdAt' | 'updatedAt';
export type VideosCreationAttributes = Optional<VideosAttributes, VideosOptionalAttributes>;
export type VideosAttributes = IVideos;
export class Videos extends Model<VideosAttributes, VideosCreationAttributes> implements VideosAttributes {
  video_id!: string;
  youtube_video_id!: string;
  video_name!: string;
  video_length!: number;
  createdAt!: Date;
  updatedAt!: Date;

  // Videos hasMany Audio_Descriptions via VideoVideoId
  Audio_Descriptions!: Audio_Descriptions[];
  getAudio_Descriptions!: Sequelize.HasManyGetAssociationsMixin<Audio_Descriptions>;
  setAudio_Descriptions!: Sequelize.HasManySetAssociationsMixin<Audio_Descriptions, Audio_DescriptionsId>;
  addAudio_Description!: Sequelize.HasManyAddAssociationMixin<Audio_Descriptions, Audio_DescriptionsId>;
  addAudio_Descriptions!: Sequelize.HasManyAddAssociationsMixin<Audio_Descriptions, Audio_DescriptionsId>;
  createAudio_Description!: Sequelize.HasManyCreateAssociationMixin<Audio_Descriptions>;
  removeAudio_Description!: Sequelize.HasManyRemoveAssociationMixin<Audio_Descriptions, Audio_DescriptionsId>;
  removeAudio_Descriptions!: Sequelize.HasManyRemoveAssociationsMixin<Audio_Descriptions, Audio_DescriptionsId>;
  hasAudio_Description!: Sequelize.HasManyHasAssociationMixin<Audio_Descriptions, Audio_DescriptionsId>;
  hasAudio_Descriptions!: Sequelize.HasManyHasAssociationsMixin<Audio_Descriptions, Audio_DescriptionsId>;
  countAudio_Descriptions!: Sequelize.HasManyCountAssociationsMixin;
  // Videos hasMany Dialog_Timestamps via VideoVideoId
  Dialog_Timestamps!: Dialog_Timestamps[];
  getDialog_Timestamps!: Sequelize.HasManyGetAssociationsMixin<Dialog_Timestamps>;
  setDialog_Timestamps!: Sequelize.HasManySetAssociationsMixin<Dialog_Timestamps, Dialog_TimestampsId>;
  addDialog_Timestamp!: Sequelize.HasManyAddAssociationMixin<Dialog_Timestamps, Dialog_TimestampsId>;
  addDialog_Timestamps!: Sequelize.HasManyAddAssociationsMixin<Dialog_Timestamps, Dialog_TimestampsId>;
  createDialog_Timestamp!: Sequelize.HasManyCreateAssociationMixin<Dialog_Timestamps>;
  removeDialog_Timestamp!: Sequelize.HasManyRemoveAssociationMixin<Dialog_Timestamps, Dialog_TimestampsId>;
  removeDialog_Timestamps!: Sequelize.HasManyRemoveAssociationsMixin<Dialog_Timestamps, Dialog_TimestampsId>;
  hasDialog_Timestamp!: Sequelize.HasManyHasAssociationMixin<Dialog_Timestamps, Dialog_TimestampsId>;
  hasDialog_Timestamps!: Sequelize.HasManyHasAssociationsMixin<Dialog_Timestamps, Dialog_TimestampsId>;
  countDialog_Timestamps!: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof Videos {
    return Videos.init(
      {
        video_id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false,
          primaryKey: true,
        },
        youtube_video_id: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        video_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        video_length: {
          type: DataTypes.DOUBLE,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          defaultValue: Sequelize.NOW,
        },
      },
      {
        sequelize,
        tableName: 'Videos',
        schema: 'public',
        timestamps: true,
        indexes: [
          {
            name: 'Videos_pkey',
            unique: true,
            fields: [{ name: 'video_id' }],
          },
        ],
      },
    );
  }
}
