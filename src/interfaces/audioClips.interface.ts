import { ObjectId } from "mongoose";
import { DataTypes } from "sequelize";

export interface IAudioClips{
    clip_id: ObjectId;
    clip_title: string;
    description_type: string;
    description_text: string;
    playback_type: string;
    clip_start_time: DataTypes.FloatDataType;
    clip_end_time: DataTypes.FloatDataType;
    clip_duration: DataTypes.FloatDataType;
    clip_audio_path: string;
    is_recorded: boolean;
    AudioDescriptionAdId: ObjectId;
}