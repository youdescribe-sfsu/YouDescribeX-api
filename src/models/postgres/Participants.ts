import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { Timings, TimingsId } from './Timings';

export interface ParticipantsAttributes {
  participant_id: string;
  participant_name: string;
  participant_email?: string;
  youtube_video_id_with_AI: string;
  youtube_video_id_without_AI: string;
  user_id_with_AI: string;
  user_id_without_AI: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ParticipantsPk = 'participant_id';
export type ParticipantsId = Participants[ParticipantsPk];
export type ParticipantsOptionalAttributes = 'participant_email' | 'createdAt' | 'updatedAt';
export type ParticipantsCreationAttributes = Optional<ParticipantsAttributes, ParticipantsOptionalAttributes>;

export class Participants extends Model<ParticipantsAttributes, ParticipantsCreationAttributes> implements ParticipantsAttributes {
  participant_id!: string;
  participant_name!: string;
  participant_email?: string;
  youtube_video_id_with_AI!: string;
  youtube_video_id_without_AI!: string;
  user_id_with_AI!: string;
  user_id_without_AI!: string;
  createdAt!: Date;
  updatedAt!: Date;

  // Participants hasMany Timings via ParticipantParticipantId
  Timings!: Timings[];
  getTimings!: Sequelize.HasManyGetAssociationsMixin<Timings>;
  setTimings!: Sequelize.HasManySetAssociationsMixin<Timings, TimingsId>;
  addTiming!: Sequelize.HasManyAddAssociationMixin<Timings, TimingsId>;
  addTimings!: Sequelize.HasManyAddAssociationsMixin<Timings, TimingsId>;
  createTiming!: Sequelize.HasManyCreateAssociationMixin<Timings>;
  removeTiming!: Sequelize.HasManyRemoveAssociationMixin<Timings, TimingsId>;
  removeTimings!: Sequelize.HasManyRemoveAssociationsMixin<Timings, TimingsId>;
  hasTiming!: Sequelize.HasManyHasAssociationMixin<Timings, TimingsId>;
  hasTimings!: Sequelize.HasManyHasAssociationsMixin<Timings, TimingsId>;
  countTimings!: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof Participants {
    return Participants.init(
      {
        participant_id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false,
          primaryKey: true,
        },
        participant_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        participant_email: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        youtube_video_id_with_AI: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        youtube_video_id_without_AI: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        user_id_with_AI: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        user_id_without_AI: {
          type: DataTypes.UUID,
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
        tableName: 'Participants',
        schema: 'public',
        timestamps: true,
        indexes: [
          {
            name: 'Participants_pkey',
            unique: true,
            fields: [{ name: 'participant_id' }],
          },
        ],
      },
    );
  }
}
