import { getPostGresConnection } from '../../databases';
import { Sequelize, Model, DataTypes } from 'sequelize';
import { AudioDescriptionsSchema } from './AudioDescriptions.postgres.model';
import { INotes } from '../../interfaces/notes.interface';
import { ObjectId } from 'mongoose';

class Notes extends Model<INotes> implements INotes {
  notes_id!: ObjectId;
  notes_text!: string;
}

// Define the User model and export it
function initNotesModel(sequelize: Sequelize) {
  Notes.init(
    {
      notes_id: {
        type: DataTypes.UUIDV4,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      notes_text: {
        allowNull: false,
        type: DataTypes.TEXT,
      },
    },
    {
      sequelize,
      modelName: 'Notes',
    },
  );
  Notes.belongsTo(AudioDescriptionsSchema);
  AudioDescriptionsSchema.hasMany(Notes);
  return Notes;
}

export const NotesSchema = initNotesModel(getPostGresConnection());

// const Sequelize = require('sequelize');
// const db = require('../config/db');
// const Audio_Descriptions = require('./Audio_Descriptions');

// const Notes = db.define('Notes', {
//   notes_id: {
//     type: Sequelize.UUID,
//     defaultValue: Sequelize.UUIDV4,
//     allowNull: false,
//     primaryKey: true,
//   },
//   notes_text: {
//     allowNull: false,
//     type: Sequelize.TEXT,
//   },
// });

// //Associations
// Notes.belongsTo(Audio_Descriptions);
// Audio_Descriptions.hasMany(Notes);

// module.exports = Notes;
