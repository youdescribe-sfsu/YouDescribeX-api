import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { Audio_Descriptions, Audio_DescriptionsId } from './Audio_Descriptions';

export interface Audio_ClipsAttributes {
  clip_id: string;
  clip_title?: string;
  description_type: string;
  description_text: string;
  playback_type: string;
  clip_start_time: number;
  clip_end_time?: number;
  clip_duration?: number;
  clip_audio_path?: string;
  is_recorded: boolean;
  createdAt: Date;
  updatedAt: Date;
  AudioDescriptionAdId?: string;
}

export type Audio_ClipsPk = 'clip_id';
export type Audio_ClipsId = Audio_Clips[Audio_ClipsPk];
export type Audio_ClipsOptionalAttributes =
  | 'clip_title'
  | 'clip_end_time'
  | 'clip_duration'
  | 'clip_audio_path'
  | 'createdAt'
  | 'updatedAt'
  | 'AudioDescriptionAdId';
export type Audio_ClipsCreationAttributes = Optional<Audio_ClipsAttributes, Audio_ClipsOptionalAttributes>;

export class Audio_Clips extends Model<Audio_ClipsAttributes, Audio_ClipsCreationAttributes> implements Audio_ClipsAttributes {
  clip_id!: string;
  clip_title?: string;
  description_type!: string;
  description_text!: string;
  playback_type!: string;
  clip_start_time!: number;
  clip_end_time?: number;
  clip_duration?: number;
  clip_audio_path?: string;
  is_recorded!: boolean;
  createdAt: Date;
  updatedAt!: Date;
  AudioDescriptionAdId?: string;

  // Audio_Clips belongsTo Audio_Descriptions via AudioDescriptionAdId
  AudioDescriptionAd!: Audio_Descriptions;
  getAudioDescriptionAd!: Sequelize.BelongsToGetAssociationMixin<Audio_Descriptions>;
  setAudioDescriptionAd!: Sequelize.BelongsToSetAssociationMixin<Audio_Descriptions, Audio_DescriptionsId>;
  createAudioDescriptionAd!: Sequelize.BelongsToCreateAssociationMixin<Audio_Descriptions>;

  static initModel(sequelize: Sequelize.Sequelize): typeof Audio_Clips {
    return Audio_Clips.init(
      {
        clip_id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false,
          primaryKey: true,
        },
        clip_title: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        description_type: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        description_text: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        playback_type: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        clip_start_time: {
          type: DataTypes.DOUBLE,
          allowNull: false,
        },
        clip_end_time: {
          type: DataTypes.DOUBLE,
          allowNull: true,
        },
        clip_duration: {
          type: DataTypes.DOUBLE,
          allowNull: true,
        },
        clip_audio_path: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        is_recorded: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          defaultValue: Sequelize.NOW,
        },
        AudioDescriptionAdId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'Audio_Descriptions',
            key: 'ad_id',
          },
        },
      },
      {
        sequelize,
        tableName: 'Audio_Clips',
        schema: 'public',
        timestamps: true,
        indexes: [
          {
            name: 'Audio_Clips_pkey',
            unique: true,
            fields: [{ name: 'clip_id' }],
          },
        ],
      },
    );
  }
}
