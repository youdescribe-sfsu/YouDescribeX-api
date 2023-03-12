import { model, Schema } from 'mongoose';
import { IVideos } from '../../interfaces/videos.interface';

const VideosSchema = new Schema<IVideos>({
  video_id: { type: String, required: true },
  video_name: { type: String, required: true },
  youtube_video_id: { type: String, required: true },
  video_length: { type: Number, required: true },
});

export const Videos = model<IVideos>('Videos', VideosSchema);
