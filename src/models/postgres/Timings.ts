import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { Participants, ParticipantsId } from './Participants';

export interface TimingsAttributes {
  id: number;
  total_time: number;
  youtube_video_id: string;
  createdAt: Date;
  updatedAt: Date;
  ParticipantParticipantId?: string;
}

export type TimingsPk = "id";
export type TimingsId = Timings[TimingsPk];
export type TimingsOptionalAttributes = "id" | "createdAt" | "updatedAt" | "ParticipantParticipantId";
export type TimingsCreationAttributes = Optional<TimingsAttributes, TimingsOptionalAttributes>;

export class Timings extends Model<TimingsAttributes, TimingsCreationAttributes> implements TimingsAttributes {
  id!: number;
  total_time!: number;
  youtube_video_id!: string;
  createdAt!: Date;
  updatedAt!: Date;
  ParticipantParticipantId?: string;

  // Timings belongsTo Participants via ParticipantParticipantId
  ParticipantParticipant!: Participants;
  getParticipantParticipant!: Sequelize.BelongsToGetAssociationMixin<Participants>;
  setParticipantParticipant!: Sequelize.BelongsToSetAssociationMixin<Participants, ParticipantsId>;
  createParticipantParticipant!: Sequelize.BelongsToCreateAssociationMixin<Participants>;

  static initModel(sequelize: Sequelize.Sequelize): typeof Timings {
    return Timings.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      total_time: {
        type: DataTypes.DOUBLE,
        allowNull: false
      },
      youtube_video_id: {
        type: DataTypes.STRING(255),
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
      ParticipantParticipantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Participants',
          key: 'participant_id'
        }
      }
    }, {
    sequelize,
    tableName: 'Timings',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "Timings_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
