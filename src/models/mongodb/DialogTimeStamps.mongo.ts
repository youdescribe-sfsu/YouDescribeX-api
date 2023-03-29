import { Schema, model, Types } from 'mongoose';

interface DialogTimestamps {
  dialog_start_time: number;
  dialog_end_time: number;
  dialog_duration: number;
  video: Types.ObjectId;
}

const DialogTimestampsSchema = new Schema<DialogTimestamps>(
  {
    dialog_start_time: { type: Number, required: true },
    dialog_end_time: { type: Number, required: true },
    dialog_duration: { type: Number, required: true },
    video: { type: Schema.Types.ObjectId, ref: 'Video', required: true },
  },
  { collection: 'dialog_timestamps' },
);

// const Dialog_Timestamps = model<DialogTimestamps>('Dialog_Timestamps', DialogTimestampsSchema);

export default DialogTimestampsSchema;
export { DialogTimestamps };
