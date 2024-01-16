import { Schema, Document, model, Types } from 'mongoose';
import { nowUtc } from '../../utils/util';

interface IVisit extends Document {
  video: Types.ObjectId;
  created_at: number;
  ip: string;
  url: string;
  youtube_id: string;
}

const VisitSchema = new Schema(
  {
    video: { type: Types.ObjectId, ref: 'Video' },
    created_at: { type: Number, required: true, default: () => nowUtc() },
    ip: String,
    url: String,
    youtube_id: String,
  },
  { collection: 'visits' },
);

export default VisitSchema;
export { IVisit };
