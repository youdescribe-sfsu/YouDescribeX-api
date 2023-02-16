import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { Videos, VideosId } from './Videos';

export interface Dialog_TimestampsAttributes {
  dialog_id: string;
  dialog_sequence_num: number;
  dialog_start_time: number;
  dialog_end_time: number;
  dialog_duration: number;
  createdAt: Date;
  updatedAt: Date;
  VideoVideoId?: string;
}

export type Dialog_TimestampsPk = "dialog_id";
export type Dialog_TimestampsId = Dialog_Timestamps[Dialog_TimestampsPk];
export type Dialog_TimestampsOptionalAttributes = "createdAt" | "updatedAt" | "VideoVideoId";
export type Dialog_TimestampsCreationAttributes = Optional<Dialog_TimestampsAttributes, Dialog_TimestampsOptionalAttributes>;

export class Dialog_Timestamps extends Model<Dialog_TimestampsAttributes, Dialog_TimestampsCreationAttributes> implements Dialog_TimestampsAttributes {
  dialog_id!: string;
  dialog_sequence_num!: number;
  dialog_start_time!: number;
  dialog_end_time!: number;
  dialog_duration!: number;
  createdAt!: Date;
  updatedAt!: Date;
  VideoVideoId?: string;

  // Dialog_Timestamps belongsTo Videos via VideoVideoId
  VideoVideo!: Videos;
  getVideoVideo!: Sequelize.BelongsToGetAssociationMixin<Videos>;
  setVideoVideo!: Sequelize.BelongsToSetAssociationMixin<Videos, VideosId>;
  createVideoVideo!: Sequelize.BelongsToCreateAssociationMixin<Videos>;

  static initModel(sequelize: Sequelize.Sequelize): typeof Dialog_Timestamps {
    return Dialog_Timestamps.init({
      dialog_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      dialog_sequence_num: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      dialog_start_time: {
        type: DataTypes.DOUBLE,
        allowNull: false
      },
      dialog_end_time: {
        type: DataTypes.DOUBLE,
        allowNull: false
      },
      dialog_duration: {
        type: DataTypes.DOUBLE,
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
      VideoVideoId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Videos',
          key: 'video_id'
        }
      },
    }, {
    sequelize,
    tableName: 'Dialog_Timestamps',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "Dialog_Timestamps_pkey",
        unique: true,
        fields: [
          { name: "dialog_id" },
        ]
      },
    ]
  });
  }
}
