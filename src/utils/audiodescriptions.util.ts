import { ClientSession, Types } from 'mongoose';
import { NewAiDescriptionDto } from '../dtos/audioDescriptions.dto';
import { CreateUserAudioDescriptionDto } from '../dtos/users.dto';
import { HttpException } from '../exceptions/HttpException';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import { IAudioDescription } from '../models/mongodb/AudioDescriptions.mongo';
import {
  MongoAudioClipsModel,
  MongoAudio_Descriptions_Model,
  MongoDialog_Timestamps_Model,
  MongoUsersModel,
  MongoVideosModel,
} from '../models/mongodb/init-models.mongo';
import { logger } from './logger';
import { getYouTubeVideoStatus, isEmpty, nowUtc, calculateContributions } from './util';
import { generateMp3forDescriptionText, nudgeStartTimeIfZero, processCurrentClip, TextToSpeechResponse, ProcessClipResponse } from './audioClips.util';
import { isVideoAvailable } from './videos.util';

// Types and Interfaces
interface ProcessedClip {
  clip_id: string;
  message: string;
  playbackType?: 'extended' | 'inline';
}

interface PopulatedAudioDescription extends IAudioClip {
  Audio_Description: {
    user: any;
    video: any;
    Video: {
      youtube_id: string;
      duration: number;
    };
  };
}

interface DescriptionText {
  clip_id: string;
  clip_description_type: string;
  clip_description_text: string;
  video_id: string;
  user_id: string;
  youtube_id: string;
  video_length: number;
}

// Audio Description Processing Service
class AudioDescriptionProcessingService {
  static async processAllClips(audioDescriptionAdId: string): Promise<ProcessedClip[]> {
    if (isEmpty(audioDescriptionAdId)) {
      throw new HttpException(400, 'Audio Description ID is empty');
    }

    try {
      // Get and populate data
      const audioClips = await PopulationService.getAudioDescriptions(audioDescriptionAdId);
      const populatedClips = await PopulationService.populateAudioClipData(audioClips);

      // Process clips
      const nudgeResult = await nudgeStartTimeIfZero(populatedClips);
      if (!nudgeResult.data) {
        throw new HttpException(409, nudgeResult.message);
      }

      // Generate descriptions
      const descriptionTexts = this.getDescriptionTexts(populatedClips);
      const processedData = await this.generateAndProcessDescriptions(descriptionTexts, audioDescriptionAdId);

      return processedData;
    } catch (error) {
      logger.error('Process clips error:', error);
      throw error;
    }
  }

  private static getDescriptionTexts(clips: PopulatedAudioDescription[]): DescriptionText[] {
    return clips.map(clip => ({
      clip_id: clip._id,
      clip_description_type: clip.description_type,
      clip_description_text: clip.description_text,
      video_id: clip.Audio_Description.video._id,
      user_id: clip.Audio_Description.user._id,
      youtube_id: clip.Audio_Description.Video.youtube_id,
      video_length: clip.Audio_Description.Video.duration,
    }));
  }

  private static async generateAndProcessDescriptions(descriptions: DescriptionText[], audioDescriptionAdId: string): Promise<ProcessedClip[]> {
    const processedClips: ProcessedClip[] = [];

    for (const desc of descriptions) {
      const ttsResult = await generateMp3forDescriptionText(audioDescriptionAdId, desc.youtube_id, desc.clip_description_text, desc.clip_description_type);

      const processResult = await processCurrentClip({
        textToSpeechOutput: ttsResult,
        clip_id: desc.clip_id,
        video_id: desc.video_id,
        ad_id: audioDescriptionAdId,
      });

      processedClips.push(processResult);
    }

    if (!processedClips.length) {
      throw new HttpException(409, 'No clips were processed');
    }

    return processedClips;
  }
}

// Population Service
class PopulationService {
  static async getAudioDescriptions(audioDescriptionAdId: string): Promise<IAudioClip[]> {
    return MongoAudioClipsModel.find({ audio_description: audioDescriptionAdId });
  }

  static async populateAudioClipData(audioDescriptions: IAudioClip[]): Promise<PopulatedAudioDescription[]> {
    const populatedClips: PopulatedAudioDescription[] = [];

    for (const audioClip of audioDescriptions) {
      const audioDesc = await MongoAudio_Descriptions_Model.findById(audioClip.audio_description);
      const video = await MongoVideosModel.findById(audioDesc.video);

      const videoAvailable = await isVideoAvailable(video.youtube_id);
      if (!videoAvailable) {
        throw new HttpException(400, `Video not available: ${video.youtube_id}`);
      }

      populatedClips.push({
        ...audioClip,
        Audio_Description: {
          user: audioDesc.user,
          video: audioDesc.video,
          Video: {
            youtube_id: video.youtube_id,
            duration: video.duration,
          },
        },
      } as PopulatedAudioDescription);
    }

    return populatedClips;
  }
}

// Contribution Service
class ContributionService {
  static async updateContributions(audioDescriptionId: string, userId: string): Promise<void> {
    const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);
    if (!audioDescription) {
      throw new HttpException(404, 'Audio Description not found');
    }

    const contributions = audioDescription.contributions;
    if (!contributions) {
      throw new HttpException(404, 'Previous contributions not found');
    }

    const prevText = await ContributionService.getConcatenatedAudioClips(audioDescription.prev_audio_description);
    const newText = await ContributionService.getConcatenatedAudioClips(audioDescriptionId);

    calculateContributions(contributions, prevText, userId, newText);

    audioDescription.contributions = contributions;
    await audioDescription.save();
  }

  private static async getConcatenatedAudioClips(audioDescriptionId: string): Promise<string> {
    try {
      const audioClips = await MongoAudioClipsModel.find({
        audio_description: audioDescriptionId,
      });

      if (!audioClips?.length) {
        return ''; // Return empty string instead of throwing error
      }

      return audioClips.reduce((text, clip) => {
        if (clip.description_text) {
          return text + clip.description_text;
        }
        return text + (clip.transcript?.reduce((transcriptText, t) => transcriptText + t.sentence, '') || '');
      }, '');
    } catch (error) {
      logger.error('Error getting concatenated audio clips:', error);
      return ''; // Return empty string on error
    }
  }
}

// AI Audio Description Service
class AIAudioDescriptionService {
  static async createNewDescription(newAIDescription: NewAiDescriptionDto): Promise<IAudioDescription & { _id: Types.ObjectId }> {
    try {
      const { dialogue_timestamps, audio_clips, aiUserId, youtube_id } = newAIDescription;

      // Validate inputs
      const videoData = await this.validateInputs(youtube_id, aiUserId);

      // Create audio description
      const audioDescription = await this.createAudioDescription(videoData.video, videoData.aiUser);

      // Create audio clips
      await this.createAudioClips(audioDescription, audio_clips, videoData.video, videoData.aiUser);

      // Create timestamps
      await this.createTimestamps(dialogue_timestamps, videoData.video);

      // Process clips
      await AudioDescriptionProcessingService.processAllClips(audioDescription._id);

      return audioDescription;
    } catch (error) {
      logger.error('AI Audio Description creation error:', error);
      throw new HttpException(500, 'Failed to create AI Audio Description');
    }
  }

  private static async validateInputs(youtubeId: string, aiUserId: string) {
    const video = await getYouTubeVideoStatus(youtubeId);
    if (!video) {
      throw new HttpException(400, 'Invalid YouTube video');
    }

    const aiUser = await MongoUsersModel.findById(aiUserId);
    if (!aiUser) {
      throw new HttpException(404, 'AI User not found');
    }

    return { video, aiUser };
  }

  private static async createAudioDescription(video: any, aiUser: any) {
    const audioDescription = new MongoAudio_Descriptions_Model();

    await MongoVideosModel.findByIdAndUpdate(video._id, {
      $push: {
        audio_descriptions: {
          $each: [{ _id: audioDescription._id }],
        },
      },
    });

    audioDescription.set('video', video._id);
    audioDescription.set('user', aiUser);

    return audioDescription;
  }

  private static async createAudioClips(audioDescription: any, clips: any[], video: any, aiUser: any) {
    const newClips = await MongoAudioClipsModel.insertMany(
      clips.map(clip => ({
        audio_description: audioDescription._id,
        user: aiUser._id,
        video: video._id,
        description_text: clip.text,
        description_type: clip.type,
        label: `scene ${clip.scene_number}`,
        playback_type: 'extended',
        start_time: clip.start_time,
      })),
    );

    audioDescription.set(
      'audio_clips',
      newClips.map(clip => clip._id),
    );

    await audioDescription.save();
    return newClips;
  }

  private static async createTimestamps(timestamps: any[], video: any) {
    return MongoDialog_Timestamps_Model.create(
      timestamps.map(timestamp => ({
        video,
        dialog_sequence_num: timestamp.sequence_num,
        dialog_start_time: timestamp.start_time,
        dialog_end_time: timestamp.end_time,
        dialog_duration: timestamp.duration,
      })),
    );
  }
}

class AutoClipsService {
  static async updateAutoClips(audioDescriptionId: string, newClips: string[]): Promise<void> {
    try {
      const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);
      if (!audioDescription) {
        logger.error('Audio Description not found');
        return null;
      }
      audioDescription.audio_clips = newClips;
      await audioDescription.save();
    } catch (error) {
      logger.error('Update auto clips error:', error);
    }
  }

  static async deepCopyAudioDescriptionWithoutNewClips(audioDescriptionId: string, toUserId: string): Promise<string | null> {
    try {
      const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);
      if (!audioDescription) {
        logger.error('Audio Description not found');
        return null;
      }

      const newAudioDescription = new MongoAudio_Descriptions_Model({
        admin_review: audioDescription.admin_review,
        audio_clips: [],
        created_at: nowUtc(),
        language: audioDescription.language,
        legacy_notes: '',
        status: 'draft',
        updated_at: nowUtc(),
        video: audioDescription.video,
        user: toUserId,
        collaborative_editing: false,
        contributions: audioDescription.contributions || new Map<string, number>([[audioDescription.user, 1]]),
        prev_audio_description: audioDescriptionId,
        depth: audioDescription.depth + 1,
      });

      await newAudioDescription.save();
      return newAudioDescription._id;
    } catch (error) {
      logger.error('Deep copy error:', error);
      return null;
    }
  }
}

export { AudioDescriptionProcessingService, PopulationService, ContributionService, AIAudioDescriptionService, AutoClipsService };

// Export functions for backward compatibility
export const deepCopyAudioDescriptionWithoutNewClips = AutoClipsService.deepCopyAudioDescriptionWithoutNewClips;
export const updateAutoClips = AutoClipsService.updateAutoClips;
export const newAIAudioDescription = AIAudioDescriptionService.createNewDescription;
export const processAllClipsInDBSession = AudioDescriptionProcessingService.processAllClips;
export const updateContributions = ContributionService.updateContributions;

// Export types
export type { ProcessedClip, PopulatedAudioDescription, DescriptionText };
