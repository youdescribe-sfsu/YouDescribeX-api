import { ObjectId } from 'mongoose';
import { DataTypes } from 'sequelize';

export interface IVideos {
  video_id: ObjectId;
  video_name: string;
  video_length: DataTypes.FloatDataType;
  youtube_video_id: string;
}
