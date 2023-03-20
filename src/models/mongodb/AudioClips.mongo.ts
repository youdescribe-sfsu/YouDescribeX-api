import { Document, Model, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Audio_DescriptionsDocument } from './AudioDescriptions.mongo';

export interface AudioClipsAttributes {
  clip_id: string;
  clip_title?: string;
  description_type: string;
  description_text: string;
  playback_type: string;
  clip_start_time: number;
  clip_end_time?: number;
  clip_duration?: number;
  clip_audio_path?: string;
  is_recorded: boolean;
  createdAt: Date;
  updatedAt: Date;
  AudioDescriptionAdId?: Schema.Types.ObjectId;
}

export interface AudioClipsDocument extends AudioClipsAttributes, Document {
  AudioDescriptionAd: Audio_DescriptionsDocument['_id'];
}

export interface AudioClipsModel extends Model<AudioClipsDocument> {
  findByClipId(clipId: string): Promise<AudioClipsDocument | null>;
}

const audioClipsSchema = new Schema<AudioClipsDocument, AudioClipsModel>(
  {
    clip_id: {
      type: String,
      default: uuidv4,
      required: true,
      unique: true,
    },
    clip_title: {
      type: String,
      required: false,
    },
    description_type: {
      type: String,
      required: true,
    },
    description_text: {
      type: String,
      required: true,
    },
    playback_type: {
      type: String,
      required: true,
    },
    clip_start_time: {
      type: Number,
      required: true,
    },
    clip_end_time: {
      type: Number,
      required: false,
    },
    clip_duration: {
      type: Number,
      required: false,
    },
    clip_audio_path: {
      type: String,
      required: false,
    },
    is_recorded: {
      type: Boolean,
      required: true,
      default: false,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    AudioDescriptionAdId: {
      type: Schema.Types.ObjectId,
      required: false,
      ref: 'AudioDescriptions',
    },
  },
  {
    timestamps: true,
    collection: 'Audio_Clips',
  },
);

audioClipsSchema.statics.findByClipId = async function (clipId: string) {
  return this.findOne({ clip_id: clipId }).populate('AudioDescriptionAd');
};

export { audioClipsSchema };
