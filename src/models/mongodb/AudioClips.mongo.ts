import mongoose, { Document, Schema } from 'mongoose';
import { nowUtc } from '../../utils/util';
import { MongoAudio_Descriptions_Model, MongoAudioClipsModel } from './init-models.mongo';
import cacheService from '../../utils/cacheService';
import { logger } from '../../utils/logger';

interface ITranscript {
  _id: string;
  sentence: string;
  start_time: number;
  end_time: number;
}

interface IAudioClip extends Document {
  // _id: string;
  audio_description: Schema.Types.ObjectId;
  created_at: number;
  description_type: 'Visual' | 'Text on Screen';
  description_text: string;
  duration: number;
  end_time: number;
  file_mime_type: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  is_recorded: boolean;
  label: string;
  playback_type: 'extended' | 'inline';
  start_time: number;
  transcript: ITranscript[];
  updated_at: number;
  user: string;
  video: string;
}

const AudioClipSchema: Schema = new Schema(
  {
    audio_description: {
      type: Schema.Types.ObjectId,
      ref: 'AudioDescription',
      required: true,
    },
    created_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
    description_type: {
      type: String,
      required: true,
    },
    description_text: {
      type: String,
    },
    duration: {
      type: Number,
      required: false,
    },
    end_time: {
      type: Number,
      required: false,
    },
    file_mime_type: {
      type: String,
      required: false,
    },
    file_name: {
      type: String,
      required: false,
    },
    file_path: {
      type: String,
      required: false,
    },
    file_size_bytes: {
      type: Number,
      required: false,
    },
    is_recorded: {
      type: Boolean,
      required: true,
      default: false,
    },
    label: {
      type: String,
      required: false,
    },
    playback_type: {
      type: String,
      required: true,
      enum: ['extended', 'inline'],
    },
    start_time: {
      type: Number,
      required: true,
    },
    transcript: [
      {
        _id: {
          type: String,
          default: () => new mongoose.Types.ObjectId().toString(),
        },
        sentence: {
          type: String,
          required: true,
        },
        start_time: {
          type: Number,
          required: true,
        },
        end_time: {
          type: Number,
          required: true,
        },
      },
    ],
    updated_at: {
      type: Number,
      required: true,
      default: () => nowUtc(),
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
    },
  },
  { collection: 'audio_clips' },
);

// Add these hooks to AudioClips.mongo.ts
AudioClipSchema.pre('updateOne', async function (next) {
  // Update this clip's timestamp
  this.set({ updated_at: nowUtc() });

  // Get the clip being updated to find its parent
  const query = this.getQuery();
  if (query._id) {
    try {
      // Find the audio clip to get its parent audio description
      const clip = await MongoAudioClipsModel.findById(query._id);
      if (clip && clip.audio_description) {
        // Update the parent audio description's timestamp
        await MongoAudio_Descriptions_Model.findByIdAndUpdate(clip.audio_description, { updated_at: nowUtc() }, { new: true });

        // Invalidate the cache
        await cacheService.invalidateByPrefix('home_videos');
      }
    } catch (error) {
      logger.error(`Error updating parent from pre-save hook: ${error.message}`);
    }
  }
  next();
});

// Similar hook for findOneAndUpdate
AudioClipSchema.pre('findOneAndUpdate', async function (next) {
  // Same implementation as above
  this.set({ updated_at: nowUtc() });

  const query = this.getQuery();
  if (query._id) {
    try {
      const clip = await MongoAudioClipsModel.findById(query._id);
      if (clip && clip.audio_description) {
        await MongoAudio_Descriptions_Model.findByIdAndUpdate(clip.audio_description, { updated_at: nowUtc() }, { new: true });

        await cacheService.invalidateByPrefix('home_videos');
      }
    } catch (error) {
      logger.error(`Error updating parent from pre-save hook: ${error.message}`);
    }
  }
  next();
});

export default AudioClipSchema;
export { IAudioClip };
