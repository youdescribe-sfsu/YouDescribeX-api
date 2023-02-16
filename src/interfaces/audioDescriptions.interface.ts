import { ObjectId } from "mongoose";

export interface IAudioDescriptions {
    ad_id: ObjectId;
    is_published: boolean;
    userUserId: ObjectId | null;
    videoVideoId: ObjectId | null;
}