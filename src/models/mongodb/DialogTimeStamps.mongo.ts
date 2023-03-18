import mongoose, { Document, Model, Schema } from 'mongoose';
import { VideosDocument } from './Videos.mongo';

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

export type Dialog_TimestampsModel = Model<Dialog_TimestampsDocument>;

export interface Dialog_TimestampsDocument extends Dialog_TimestampsAttributes, Document {
  VideoVideo: VideosDocument['id'];
}

export type Dialog_TimestampsOptionalAttributes = 'createdAt' | 'updatedAt' | 'VideoVideoId';

const Dialog_TimestampsSchema = new Schema<Dialog_TimestampsDocument>({
  dialog_id: {
    type: String,
    required: true,
    unique: true,
  },
  dialog_sequence_num: {
    type: Number,
    required: true,
  },
  dialog_start_time: {
    type: Number,
    required: true,
  },
  dialog_end_time: {
    type: Number,
    required: true,
  },
  dialog_duration: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  VideoVideoId: {
    type: String,
    ref: 'Videos',
  },
});

export { Dialog_TimestampsSchema };
