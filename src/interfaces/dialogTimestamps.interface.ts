import { ObjectId } from 'mongoose';
import { DataTypes } from 'sequelize/types';

export interface IDialogTimeStamps {
  dialog_id: ObjectId;
  dialog_sequence_num: number;
  dialog_start_time: DataTypes.FloatDataType;
  dialog_end_time: DataTypes.FloatDataType;
  dialog_duration: DataTypes.FloatDataType;
}
