import { getPostGresConnection } from '../../databases';
import { Sequelize, Model, DataTypes } from 'sequelize';
import { VideosSchema } from './Videos.postgres.model';
import { IDialogTimeStamps } from '../../interfaces/dialogTimestamps.interface';
import { ObjectId } from 'mongoose';


class DialogTimestamps extends Model<IDialogTimeStamps> implements IDialogTimeStamps {
  dialog_id!: ObjectId;
  dialog_sequence_num!: number;
  dialog_start_time!: DataTypes.FloatDataType;
  dialog_end_time!: DataTypes.FloatDataType;
  dialog_duration!: DataTypes.FloatDataType;
}

// Define the User model and export it
function initDialogTimestampsModel(sequelize: Sequelize) {
  DialogTimestamps.init(
    {
      dialog_id: {
        type: DataTypes.UUIDV4,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      dialog_sequence_num: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      dialog_start_time: {
        allowNull: false,
        type: DataTypes.FLOAT,
      },
      dialog_end_time: {
        allowNull: false,
        type: DataTypes.FLOAT,
      },
      dialog_duration: {
        allowNull: false,
        type: DataTypes.FLOAT,
      },
    },
    {
      sequelize,
      modelName: 'Dialog_Timestamps',
    },
  );
  DialogTimestamps.belongsTo(VideosSchema)
  return DialogTimestamps
}

export const DialogTimestampsSchema = initDialogTimestampsModel(getPostGresConnection());


// const Sequelize = require('sequelize');
// const db = require('../config/db');
// const Videos = require('./Videos');

// const Dialog_Timestamps = db.define('Dialog_Timestamps', {
//   dialog_id: {
//     type: Sequelize.UUID,
//     defaultValue: Sequelize.UUIDV4,
//     allowNull: false,
//     primaryKey: true,
//   },
//   dialog_sequence_num: {
//     allowNull: false,
//     type: Sequelize.INTEGER,
//   },
//   dialog_start_time: {
//     allowNull: false,
//     type: Sequelize.FLOAT,
//   },
//   dialog_end_time: {
//     allowNull: false,
//     type: Sequelize.FLOAT,
//   },
//   dialog_duration: {
//     allowNull: false,
//     type: Sequelize.FLOAT,
//   },
// });

// //Associations
// Dialog_Timestamps.belongsTo(Videos);

// module.exports = Dialog_Timestamps;
