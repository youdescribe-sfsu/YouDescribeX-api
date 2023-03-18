import mongoose, { Schema, Document, Types } from 'mongoose';
import { Audio_DescriptionsDocument } from './AudioDescriptions.mongo';
export type ObjectId = Types.ObjectId;

export interface UsersAttributes {
  user_id: ObjectId;
  is_ai: boolean;
  name: string;
  user_email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsersDocument extends UsersAttributes, Document {
  Audio_Descriptions: Audio_DescriptionsDocument['_id'];
}

const UsersSchema = new Schema<UsersDocument>({
  user_id: {
    type: Schema.Types.ObjectId,
    required: true,
    default: () => new Types.ObjectId(),
    unique: true,
  },
  is_ai: {
    type: Boolean,
    required: true,
    default: false,
  },
  name: {
    type: String,
    required: true,
  },
  user_email: {
    type: String,
    default: null,
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
  Audio_Descriptions: [{ type: Schema.Types.ObjectId, ref: 'Audio_Descriptions' }],
});

export { UsersSchema };
