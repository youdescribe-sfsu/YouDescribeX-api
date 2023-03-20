import { Document, Model, Schema } from 'mongoose';

export interface VideosAttributes {
  video_id: string;
  youtube_video_id: string;
  video_name: string;
  video_length: number;
  createdAt: Date;
  updatedAt: Date;
}

export type VideosDocument = Document & VideosAttributes;

export interface VideosModel extends Model<VideosDocument> {
  findByVideoId(video_id: string): Promise<VideosDocument | null>;
}

const videosSchema = new Schema<VideosDocument, VideosModel>(
  {
    video_id: {
      type: String,
      required: true,
      unique: true,
    },
    youtube_video_id: {
      type: String,
      required: true,
    },
    video_name: {
      type: String,
      required: true,
    },
    video_length: {
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
  },
  {
    timestamps: true,
    collection: 'Videos',
    collation: { locale: 'en_US', strength: 1 },
  },
);

videosSchema.statics.findByVideoId = async function (video_id: string): Promise<VideosDocument | null> {
  return this.findOne({ video_id }).populate('AudioDescriptions').populate('DialogTimestamps');
};

export { videosSchema };
