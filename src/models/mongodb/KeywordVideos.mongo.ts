import mongoose, { Document, Schema } from 'mongoose';

interface IKeywordVideos extends Document {
  keyword: string;
  data: string;
  created_at?: Date;
}

const KeywordVideosSchema = new Schema<IKeywordVideos>({
  keyword: { type: String, required: true },
  data: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});
KeywordVideosSchema.index({ created_at: 1 }, { expireAfterSeconds: 604800 });

const KeywordVideosModel = mongoose.model<IKeywordVideos>('KeywordVideos', KeywordVideosSchema);

export default KeywordVideosModel;
export { IKeywordVideos };
