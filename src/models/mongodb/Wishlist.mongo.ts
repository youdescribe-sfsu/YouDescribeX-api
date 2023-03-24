import { Document, Schema, model } from 'mongoose';

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

const schema = new Schema<IWishList>(
  {
    youtube_id: String,
    category: String,
    category_id: Number,
    created_at: Number,
    duration: Number,
    status: String,
    tags: [String],
    updated_at: Number,
    votes: Number,
    youtube_status: String,
  },
  { collection: 'wish_list' },
);

export default model<IWishList>('WishList', schema);
