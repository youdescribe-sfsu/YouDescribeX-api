import { model, Schema, Types } from 'mongoose';
import { IAudioClips } from '../../interfaces/audioClips.interface';

const AudioClipsSchema = new Schema<IAudioClips>({
  clip_id: {
    type: Types.ObjectId,
    required: true,
    unique: true,
    default: Schema.Types.ObjectId,
  },
  clip_title: { type: String },
  description_type: { type: String, required: true },
  description_text: { type: String, required: true },
  playback_type: { type: String, required: true },
  clip_start_time: { type: Number, required: true },
  clip_end_time: { type: Number },
  clip_duration: { type: Number },
  clip_audio_path: { type: String },
  is_recorded: { type: Boolean, required: true, default: false },
});

export const AudioClips = model<IAudioClips>('Audio_Clips', AudioClipsSchema);

// const Audio_Clips_Schema = mongoDb.Schema({
//     clip_id: {
//         type: String,
//         default: mongoose.Types.ObjectId,
//         required: [true],
//         unique: true,
//     },
//     clip_title: {
//         type: String
//     },
//     description_type: {
//         type: String,
//         required: [true],
//     },
//     description_text: {
//         type: String,
//         required: [true],
//     },
//     playback_type: {
//         type: String,
//         required: [true],
//     },
//     clip_start_time: {
//         type: Number,
//         required: [true],
//     },
//     clip_end_time: {
//         type: Number,
//     },
//     clip_duration: {
//         type: Number,
//     },
//     clip_audio_path:{
//         type: String,
//     },
//     is_recorded: {
//         type: Boolean,
//         required: [true],
//         default: false,
//     }
// });
// const Audio_Clips_Mongo = mongoDb.model('Audio_Clips', Audio_Clips_Schema);

// module.exports = Audio_Clips_Mongo;
