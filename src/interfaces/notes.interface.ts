import { ObjectId } from "mongoose";

export interface INotes {
    notes_id: ObjectId;
    notes_text: string;
}