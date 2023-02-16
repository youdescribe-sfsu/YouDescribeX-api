import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { Audio_Descriptions, Audio_DescriptionsId } from './Audio_Descriptions';

export interface NotesAttributes {
  notes_id: string;
  notes_text: string;
  createdAt: Date;
  updatedAt: Date;
  AudioDescriptionAdId?: string;
}

export type NotesPk = "notes_id";
export type NotesId = Notes[NotesPk];
export type NotesOptionalAttributes = "createdAt" | "updatedAt" | "AudioDescriptionAdId";
export type NotesCreationAttributes = Optional<NotesAttributes, NotesOptionalAttributes>;

export class Notes extends Model<NotesAttributes, NotesCreationAttributes> implements NotesAttributes {
  notes_id!: string;
  notes_text!: string;
  createdAt!: Date;
  updatedAt!: Date;
  AudioDescriptionAdId?: string;

  // Notes belongsTo Audio_Descriptions via AudioDescriptionAdId
  AudioDescriptionAd!: Audio_Descriptions;
  getAudioDescriptionAd!: Sequelize.BelongsToGetAssociationMixin<Audio_Descriptions>;
  setAudioDescriptionAd!: Sequelize.BelongsToSetAssociationMixin<Audio_Descriptions, Audio_DescriptionsId>;
  createAudioDescriptionAd!: Sequelize.BelongsToCreateAssociationMixin<Audio_Descriptions>;

  static initModel(sequelize: Sequelize.Sequelize): typeof Notes {
    return Notes.init({
      notes_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      notes_text: {
        type: DataTypes.TEXT,
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
      AudioDescriptionAdId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Audio_Descriptions',
          key: 'ad_id'
        }
      }
    }, {
    sequelize,
    tableName: 'Notes',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: "Notes_pkey",
        unique: true,
        fields: [
          { name: "notes_id" },
        ]
      },
    ]
  });
  }
}
