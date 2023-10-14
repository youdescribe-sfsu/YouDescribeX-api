import { ObjectId } from 'mongoose';

export interface IAudioDescriptions {
  ad_id: ObjectId;
  userUserId: ObjectId | null;
  videoVideoId: ObjectId | null;
}
