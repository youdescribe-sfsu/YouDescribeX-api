import mongoose, { Schema, Document } from 'mongoose';

export interface NotesDocument extends Document {
  notes_id: string;
  notes_text: string;
  createdAt: Date;
  updatedAt: Date;
  AudioDescriptionAdId?: string;
}

const NotesSchema = new Schema(
  {
    notes_id: {
      type: String,
      required: true,
      default: () => new mongoose.Types.ObjectId().toString(),
      unique: true,
    },
    notes_text: {
      type: String,
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
    AudioDescriptionAdId: {
      type: String,
      ref: 'Audio_Descriptions',
    },
  },
  {
    timestamps: true,
    collection: 'Notes',
    versionKey: false,
  },
);

export { NotesSchema };
