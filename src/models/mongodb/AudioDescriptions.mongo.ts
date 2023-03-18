import { Schema, Document, Model, Types, model } from 'mongoose';
import { AudioClipsDocument } from './AudioClips.mongo';
import { NotesDocument } from './Notes.mongo';
import { UsersDocument } from './User.mongo';
import { VideosDocument } from './Videos.mongo';

export interface Audio_DescriptionsAttributes {
  ad_id: string;
  is_published: boolean;
  createdAt: Date;
  updatedAt: Date;
  UserUserId?: string;
  VideoVideoId?: string;
}

export type Audio_DescriptionsDocument = Document &
  Audio_DescriptionsAttributes & {
    Audio_Clips: Types.Array<AudioClipsDocument['id']>;
    Notes: Types.Array<NotesDocument['id']>;
    UserUser?: UsersDocument['id'];
    VideoVideo?: VideosDocument['_id'];
  };

export type Audio_DescriptionsModel = Model<Audio_DescriptionsDocument>;

const Audio_DescriptionsSchema = new Schema<Audio_DescriptionsDocument, Audio_DescriptionsModel>(
  {
    ad_id: {
      type: String,
      required: true,
      unique: true,
    },
    is_published: {
      type: Boolean,
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
    UserUserId: {
      type: String,
      ref: 'Users',
    },
    VideoVideoId: {
      type: String,
      ref: 'Videos',
    },
    Audio_Clips: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Audio_Clips',
      },
    ],
    Notes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Notes',
      },
    ],
  },
  {
    timestamps: true,
  },
);

export { Audio_DescriptionsSchema };
