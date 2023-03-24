import { Schema, Document, model, Types } from 'mongoose';

interface IVisit extends Document {
  video: Types.ObjectId;
  created_at: Date;
  ip: string;
  url: string;
  youtube_id: string;
}

const VisitSchema = new Schema(
  {
    video: { type: Types.ObjectId, ref: 'Video' },
    created_at: { type: Date, default: Date.now },
    ip: String,
    url: String,
    youtube_id: String,
  },
  { collection: 'visits' },
);

const VisitModel = model<IVisit>('Visit', VisitSchema);

export { VisitModel, IVisit };
