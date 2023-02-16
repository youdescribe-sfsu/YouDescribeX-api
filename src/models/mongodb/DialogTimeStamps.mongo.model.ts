import mongoose, { model, Types, Schema } from 'mongoose';
import { IDialogTimeStamps } from '../../interfaces/dialogTimestamps.interface';

const DialogTimeStampsSchema = new Schema<IDialogTimeStamps>({
  dialog_id: { type: Types.ObjectId, required: true, unique: true, default: mongoose.Types.ObjectId },
  dialog_sequence_num: { type: Number, required: true },
  dialog_start_time: { type: Number, required: true },
  dialog_end_time: { type: Number, required: true },
  dialog_duration: { type: Number, required: true },
});

export const DialogTimeStamps = model<IDialogTimeStamps>('Dialog_TimeStamp', DialogTimeStampsSchema);
