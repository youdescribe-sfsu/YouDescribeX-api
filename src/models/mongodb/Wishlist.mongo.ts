import { Document, Schema, model } from 'mongoose';
import { nowUtc } from '../../utils/util';

interface IWishList extends Document {
  youtube_id: string;
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

export default WishlistSchema;
export { IWishList };
