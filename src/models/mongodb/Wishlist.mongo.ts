import { Document, Schema } from 'mongoose';
import { nowUtc } from '../../utils/util';
import { MongoVideosModel } from './init-models.mongo';

interface IWishList extends Document {
  youtube_id: string;
  video: string;
  category: string;
  category_id: number;
  created_at: number;
  duration: number;
  status: string;
  tags: string[];
  updated_at: number;
  votes: Number;
  youtube_status: string;
}

const WishlistSchema = new Schema<IWishList>(
  {
    youtube_id: {
      type: String,
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      index: true,
    } as any,
    category: {
      type: String,
      required: true,
    },
    category_id: {
      type: Number,
      required: true,
    },
    created_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
    duration: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    tags: [String],
    updated_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
    votes: Number,
    youtube_status: {
      type: String,
      required: true,
    },
  },
  { collection: 'wish_list' },
);

WishlistSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('youtube_id')) {
    const video = await MongoVideosModel.findOne({ youtube_id: this.youtube_id });
    if (video) {
      this.video = video._id;
    }
  }
  next();
});

export default WishlistSchema;
export { IWishList };
