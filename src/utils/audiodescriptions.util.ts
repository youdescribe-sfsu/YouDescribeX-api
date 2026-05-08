import { Types } from 'mongoose';
import { NewAiDescriptionDto } from '../dtos/audioDescriptions.dto';
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
import { getYouTubeVideoStatus, isEmpty, nowUtc, calculateEdittingDistance } from './util';
import { generateMp3forDescriptionText, nudgeStartTimeIfZero, processCurrentClip } from './audioClips.util';
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
      if (!audioDesc) {
        throw new HttpException(404, 'Parent Audio Description not found');
      }
      const video = await MongoVideosModel.findById(audioDesc.video);
      if (!video) {
        throw new HttpException(404, 'Associated Video not found');
      }
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
    logger.info(`[COLLAB] Starting contribution update for audio description ${audioDescriptionId} by user ${userId}`);

    try {
      const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);
      if (!audioDescription) {
        throw new HttpException(404, 'Audio Description not found');
      }

      // First-version case: no parent → 100% to current user
      if (!audioDescription.prev_audio_description) {
        audioDescription.contributions = { [userId]: 1 };
        await audioDescription.save();
        return;
      }

      const prevAudioDescription = await MongoAudio_Descriptions_Model.findById(audioDescription.prev_audio_description);
      if (!prevAudioDescription) {
        // Parent missing — fall back to current user owns 100%
        audioDescription.contributions = { [userId]: 1 };
        await audioDescription.save();
        return;
      }

      // Load all clips from both versions
      const [prevClips, newClips] = await Promise.all([
        MongoAudioClipsModel.find({ audio_description: audioDescription.prev_audio_description }).sort({ start_time: 1 }),
        MongoAudioClipsModel.find({ audio_description: audioDescriptionId }).sort({ start_time: 1 }),
      ]);

      // Build lookup of previous clips by ID for O(1) matching
      const prevClipsById = new Map(prevClips.map(c => [c._id.toString(), c]));
      const matchedPrevIds = new Set<string>();

      // Per-clip retention weights (from MDCI paper)
      const W_TEXT = 0.45;
      const W_TIME = 0.45;
      const W_PB = 0.05;
      const W_VOICE = 0.05;
      const TIME_THRESHOLD_SECONDS = 5.0;

      let weightedRetentionSum = 0; // Σ(w_i · R_i) for matched clips
      let totalWeight = 0; // Σ w_i + Σ w_j + Σ w_k (matched + deleted + inserted)

      // Process each clip in the new version
      for (const newClip of newClips) {
        const w = Math.max(newClip.duration || 1, 0.1); // duration as weight, floor at 0.1
        const prevId = newClip.prev_clip_id?.toString();
        const matchedPrev = prevId ? prevClipsById.get(prevId) : undefined;

        if (matchedPrev) {
          // Matched clip — compute retention R_i
          matchedPrevIds.add(prevId);

          // S_text: 1 - normalized Levenshtein
          const prevText = matchedPrev.description_text || '';
          const newText = newClip.description_text || '';
          const editDist = calculateEdittingDistance(prevText, newText);
          const maxLen = Math.max(prevText.length, newText.length, 1);
          const sText = 1 - editDist / maxLen;

          // S_time: linear decay over threshold
          const deltaTime = Math.abs((newClip.start_time || 0) - (matchedPrev.start_time || 0));
          const sTime = Math.max(0, 1 - deltaTime / TIME_THRESHOLD_SECONDS);

          // S_pb: binary
          const sPb = newClip.playback_type === matchedPrev.playback_type ? 1 : 0;

          // S_voice: binary
          const sVoice = newClip.is_recorded === matchedPrev.is_recorded ? 1 : 0;

          const R = W_TEXT * sText + W_TIME * sTime + W_PB * sPb + W_VOICE * sVoice;

          weightedRetentionSum += w * R;
          totalWeight += w;

          logger.debug(
            `[COLLAB] Matched clip ${newClip._id}: R=${R.toFixed(3)} (text=${sText.toFixed(2)}, time=${sTime.toFixed(2)}, pb=${sPb}, voice=${sVoice})`,
          );
        } else {
          // Inserted clip — R = 0, weight goes into denominator only
          totalWeight += w;
          logger.debug(`[COLLAB] Inserted clip ${newClip._id}, weight ${w.toFixed(2)}`);
        }
      }

      // Process deleted clips (in prev but not matched)
      for (const prevClip of prevClips) {
        if (!matchedPrevIds.has(prevClip._id.toString())) {
          const w = Math.max(prevClip.duration || 1, 0.1);
          totalWeight += w;
          logger.debug(`[COLLAB] Deleted clip ${prevClip._id}, weight ${w.toFixed(2)}`);
        }
      }

      // Aggregate
      const C_AI_local = totalWeight > 0 ? weightedRetentionSum / totalWeight : 0;
      const C_H_local = 1 - C_AI_local;

      logger.info(`[COLLAB] Local contributions: AI(prev)=${(C_AI_local * 100).toFixed(2)}%, Human(current)=${(C_H_local * 100).toFixed(2)}%`);

      // Cascade: scale parent's existing contributions by C_AI_local, give current user C_H_local
      const parentContributions: Record<string, number> = (prevAudioDescription.contributions as Record<string, number>) || {};
      const newContributions: Record<string, number> = {};

      if (Object.keys(parentContributions).length === 0) {
        // Parent has no contributions recorded → attribute to parent's user
        newContributions[prevAudioDescription.user.toString()] = C_AI_local;
      } else {
        for (const [uid, share] of Object.entries(parentContributions)) {
          newContributions[uid] = share * C_AI_local;
        }
      }

      // Add current user's share
      newContributions[userId] = (newContributions[userId] || 0) + C_H_local;

      logger.info(`[COLLAB] Final contributions: ${JSON.stringify(newContributions)}`);

      await MongoAudio_Descriptions_Model.findByIdAndUpdate(audioDescriptionId, { $set: { contributions: newContributions } }, { new: true });

      logger.info(`[COLLAB] Successfully updated contributions for ${audioDescriptionId}`);
    } catch (error: any) {
      logger.error(`[COLLAB] Error updating contributions for ${audioDescriptionId}: ${error.message}`);
      throw error;
    }
  }
  static async getConcatenatedAudioClips(audioDescriptionId: string): Promise<string> {
    logger.info(`[COLLAB] Getting concatenated audio clips for ${audioDescriptionId}`);

    try {
      if (!audioDescriptionId) {
        logger.warn(`[COLLAB] Empty audioDescriptionId passed to getConcatenatedAudioClips`);
        return '';
      }

      // Log method caller information if possible
      const stack = new Error().stack;
      logger.debug(`[COLLAB] getConcatenatedAudioClips called from: ${stack?.split('\n')[2]?.trim() || 'unknown'}`);

      const audioClips = await MongoAudioClipsModel.find({
        audio_description: audioDescriptionId,
      });

      logger.info(`[COLLAB] Found ${audioClips?.length || 0} audio clips for ${audioDescriptionId}`);

      const result = audioClips.reduce((text, clip) => {
        const clipText = clip.description_text || clip.transcript?.reduce((transcriptText, t) => transcriptText + t.sentence, '') || '';
        logger.debug(`[COLLAB] Adding clip ${clip._id}, text length: ${clipText.length} chars`);
        return text + clipText;
      }, '');

      logger.info(`[COLLAB] Concatenated text length: ${result.length} chars for ${audioDescriptionId}`);
      return result;
    } catch (error: any) {
      logger.error(`[COLLAB] Error getting concatenated audio clips for ${audioDescriptionId}: ${error.message}`);
      logger.error(`[COLLAB] Stack trace: ${error.stack}`);
      return '';
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
        return;
      }
      audioDescription.audio_clips = newClips;
      await audioDescription.save();
    } catch (error) {
      logger.error('Update auto clips error:', error);
    }
  }

  static async findExistingCollaborativeDraft(audioDescriptionId: string, toUserId: string): Promise<string | null> {
    const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);

    if (!audioDescription) {
      return null;
    }

    const existingDraft = await MongoAudio_Descriptions_Model.findOne({
      prev_audio_description: audioDescription._id,
      //status: 'draft',
      user: toUserId,
      video: audioDescription.video,
    });

    return existingDraft ? existingDraft._id.toString() : null;
  }

  static async deepCopyAudioDescriptionWithoutNewClips(audioDescriptionId: string, toUserId: string): Promise<string | null> {
    logger.info(`[COLLAB] Starting deep copy of audio description ${audioDescriptionId} for user ${toUserId}`);

    try {
      const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId);
      if (!audioDescription) {
        logger.error(`[COLLAB] Audio Description ${audioDescriptionId} not found for copying`);
        return null;
      }

      logger.info(`[COLLAB] Original audio description: user ${audioDescription.user}, depth ${audioDescription.depth || 1}`);
      logger.debug(`[COLLAB] Original contributions: ${JSON.stringify(audioDescription.contributions || {})}`);

      // Initialize contributions as a plain JavaScript object
      // 1. Initialize with the correct type
      let initialContributions: Record<string, number> = {};

      if (audioDescription.contributions && typeof audioDescription.contributions === 'object') {
        // 2. Cast the spread object to satisfy the Record type
        initialContributions = { ...(audioDescription.contributions as Record<string, number>) };
      } else {
        // 3. This is now safe because initialContributions has a string index signature
        initialContributions[audioDescription.user.toString()] = 1;
      }

      // Create new audio description with proper collaborative chain references
      const newAudioDescription = new MongoAudio_Descriptions_Model({
        admin_review: audioDescription.admin_review,
        audio_clips: [], // Start with empty, will be copied later
        created_at: nowUtc(),
        language: audioDescription.language,
        legacy_notes: audioDescription.legacy_notes || '',
        status: 'draft', // Always start as draft
        updated_at: nowUtc(),
        video: audioDescription.video,
        user: toUserId,
        collaborative_editing: true,
        contributions: initialContributions,
        prev_audio_description: audioDescriptionId,
        depth: (audioDescription.depth || 1) + 1,
      });

      await newAudioDescription.save();

      // Add to video's audio_descriptions array with addToSet to prevent duplicates
      await MongoVideosModel.findByIdAndUpdate(audioDescription.video, {
        $addToSet: { audio_descriptions: newAudioDescription._id },
      });
      logger.info(`[COLLAB] Created new audio description ${newAudioDescription._id} with depth ${newAudioDescription.depth}`);
      return newAudioDescription._id.toString();
    } catch (error: any) {
      logger.error(`[COLLAB] Error in deep copy: ${error.message}`);
      logger.error(`[COLLAB] Error stack: ${error.stack}`);
      return null;
    }
  }
}

export const updateAudioDescription = async (id: string, updateData: any) => {
  // Always include the updated_at field
  const updatedData = {
    ...updateData,
    updated_at: nowUtc(),
  };

  return await MongoAudio_Descriptions_Model.findByIdAndUpdate(id, updatedData, { new: true });
};

export { AudioDescriptionProcessingService, PopulationService, ContributionService, AIAudioDescriptionService, AutoClipsService };

// Export functions for backward compatibility
export const findExistingCollaborativeDraft = AutoClipsService.findExistingCollaborativeDraft;
export const deepCopyAudioDescriptionWithoutNewClips = AutoClipsService.deepCopyAudioDescriptionWithoutNewClips;
export const updateAutoClips = AutoClipsService.updateAutoClips;
export const newAIAudioDescription = AIAudioDescriptionService.createNewDescription;
export const processAllClipsInDBSession = AudioDescriptionProcessingService.processAllClips;
export const updateContributions = ContributionService.updateContributions;

// Export types
export type { ProcessedClip, PopulatedAudioDescription, DescriptionText };
