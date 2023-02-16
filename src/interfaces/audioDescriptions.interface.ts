import { ObjectId } from "mongoose";

export interface IAudioDescriptions {
    ad_id: ObjectId;
    is_published: boolean;
}