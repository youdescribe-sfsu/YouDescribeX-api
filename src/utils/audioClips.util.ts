import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import getMP3Duration from 'get-mp3-duration';
import mime from 'mime-types';
import { ClientSession } from 'mongoose';
import multer from 'multer';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import { MongoAudioClipsModel, MongoDialog_Timestamps_Model } from '../models/mongodb/init-models.mongo';
import { Audio_Clips, Dialog_Timestamps, Videos } from '../models/postgres/init-models';
import { logger } from './logger';
import { getYouTubeVideoStatus, nowUtc } from './util';
import path from 'path';

// Types and Interfaces
interface TextToSpeechResponse {
  status: boolean;
  filepath: string | null;
  filename: string | null;
  file_mime_type: string | null;
  file_size_bytes: number;
}

interface PlaybackAnalysisResponse {
  message: string;
  data: 'extended' | 'inline' | null;
}

interface ClipStartTimeResponse {
  message: string;
  data: string | null;
}

interface AudioPathResponse {
  message: string;
  data: string | null;
}

interface ProcessClipResponse {
  clip_id: string;
  message: string;
  playbackType?: 'extended' | 'inline';
}

interface NudgeStartTimeResult {
  data: any[] | null;
  message: string;
}

// Type Guards
function isIAudioClip(clip: IAudioClip | Audio_Clips): clip is IAudioClip {
  return (clip as IAudioClip).start_time !== undefined;
}

function isAudioClips(clip: IAudioClip | Audio_Clips): clip is Audio_Clips {
  return (clip as Audio_Clips).clip_start_time !== undefined;
}

// Main Services
class FileManagementService {
  static ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  static async getAudioDuration(filepath: string): Promise<{ message: string; data: string | null }> {
    const newPath = CONFIG.app.audioDirectory + filepath.replace('.', '');
    logger.info(`Calculating duration for: ${newPath}`);

    try {
      const buffer = fs.readFileSync(newPath);
      const duration = (getMP3Duration(buffer) / 1000).toFixed(2);
      return { message: 'Success', data: duration };
    } catch (err) {
      logger.error('Audio Duration Error:', err);
      return { message: 'Error in Getting Audio Duration', data: null };
    }
  }

  static deleteFile(filepath: string): boolean {
    try {
      const normalizedPath = filepath.startsWith('.') ? filepath.substring(1) : filepath;

      const fullPath = `${CONFIG.app.audioDirectory}${normalizedPath}`;

      const finalPath = fullPath.endsWith('.mp3') ? fullPath : `${fullPath}.mp3`;

      if (!fs.existsSync(finalPath)) {
        logger.error(`File does not exist: ${finalPath}`);
        return false;
      }

      fs.unlinkSync(finalPath);
      logger.info('File deleted successfully:', finalPath);
      return true;
    } catch (err) {
      logger.error('File deletion error:', err);
      return false;
    }
  }

  static copyFile(oldPath: string, youtubeVideoId: string, fileName: string, adId: string): string {
    const normalizedPath = oldPath.replace(/^\./, '');
    const oldAbsPath = `${CONFIG.app.audioDirectory}${normalizedPath}/${fileName}`;

    if (!fs.existsSync(oldAbsPath)) {
      logger.error(`File does not exist: ${oldAbsPath}`);
      return oldPath;
    }

    const newPath = `${CONFIG.app.audioDirectory}/audio/${youtubeVideoId}/${adId}/${fileName}`;
    try {
      const targetDir = path.dirname(newPath);
      fs.mkdirSync(targetDir, { recursive: true });

      fs.copyFileSync(oldAbsPath, newPath);
      return `/audio/${youtubeVideoId}/${adId}`;
    } catch (err) {
      logger.error('File copy error:', err);
      return oldPath;
    }
  }
}

class AudioClipService {
  private static textToSpeechClient = new TextToSpeechClient({
    keyFilename: CONFIG.google.textToSpeech.credentialsPath,
  });

  static async generateMp3forDescriptionText(
    adId: string,
    youtubeVideoId: string,
    clipDescriptionText: string,
    clipDescriptionType: string,
  ): Promise<TextToSpeechResponse> {
    try {
      const voiceName = clipDescriptionType === 'Visual' ? 'en-US-Wavenet-D' : 'en-US-Wavenet-C';
      const [response] = await this.textToSpeechClient.synthesizeSpeech({
        input: { text: clipDescriptionText },
        voice: {
          languageCode: 'en-US',
          name: voiceName,
          ssmlGender: 'NEUTRAL',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.25,
        },
      });

      const uniqueId = uuidv4();
      const type = clipDescriptionType === 'Visual' ? 'nonOCR' : 'OCR';
      const fileName = `${type}-${uniqueId}.mp3`;
      const dir = `${CONFIG.app.audioDirectory}/audio/${youtubeVideoId}/${adId}`;

      FileManagementService.ensureDirectoryExists(dir);

      const filepath = `${dir}/${fileName}`;
      await fs.promises.writeFile(filepath, response.audioContent, 'binary');

      const fileMimeType = mime.lookup(filepath);
      const fileSizeBytes = fs.statSync(filepath).size;
      const servingFilepath = `./audio/${youtubeVideoId}/${adId}`;

      return {
        status: true,
        filepath: servingFilepath,
        filename: fileName,
        file_mime_type: fileMimeType || 'audio/mpeg',
        file_size_bytes: fileSizeBytes,
      };
    } catch (error) {
      logger.error('Text-to-Speech Error:', error);
      return {
        status: false,
        filepath: null,
        filename: null,
        file_mime_type: null,
        file_size_bytes: -1,
      };
    }
  }

  static async analyzePlaybackType(
    startTime: number,
    endTime: number,
    videoId: string,
    adId: string,
    clipId: string | null,
    processingAllClips: boolean,
    requestedPlaybackType?: 'extended' | 'inline',
  ): Promise<PlaybackAnalysisResponse> {
    try {
      if (requestedPlaybackType === 'extended') {
        return { message: 'Success - using requested extended type', data: 'extended' };
      }

      const overlappingDialogs = await MongoDialog_Timestamps_Model.find({
        video: videoId,
        $and: [{ dialog_start_time: { $lte: endTime } }, { dialog_end_time: { $gte: startTime } }],
      });

      if (overlappingDialogs.length !== 0) {
        return { message: 'Success - extended!', data: 'extended' };
      }

      const overlappingClips = await MongoAudioClipsModel.find({
        audio_description: adId,
        $and: [{ start_time: { $lte: endTime } }, { end_time: { $gte: startTime } }, { _id: { $ne: clipId } }],
      });

      if (overlappingClips.length === 0) {
        return { message: 'Success - inline!', data: 'inline' };
      }

      if (processingAllClips) {
        const clipsAfter = overlappingClips.filter(clip => clip.start_time > startTime);
        return {
          message: 'Success - ' + (clipsAfter.length > 0 ? 'extended!' : 'inline!'),
          data: clipsAfter.length > 0 ? 'extended' : 'inline',
        };
      }

      return { message: 'Success - extended!', data: 'extended' };
    } catch (error) {
      logger.error('Playback Analysis Error:', error);
      return {
        message: 'Unable to analyze playback type',
        data: null,
      };
    }
  }
}

class DatabaseService {
  static async nudgeStartTimeIfZero(audioClips: Audio_Clips[] | IAudioClip[]): Promise<NudgeStartTimeResult> {
    const startTimeZeroaudioClipIds: string[] = [];

    for (const clip of audioClips) {
      if (isAudioClips(clip)) {
        if (clip.clip_start_time === 0) {
          startTimeZeroaudioClipIds.push(clip.clip_id);
        }
      } else if (isIAudioClip(clip)) {
        if (clip.start_time === 0) {
          startTimeZeroaudioClipIds.push(clip._id);
        }
      }
    }

    if (startTimeZeroaudioClipIds.length === 0) {
      return {
        data: [],
        message: 'None of the clips are starting at 0sec. Success OK!',
      };
    }

    try {
      const clipsToUpdate = await MongoAudioClipsModel.find({
        _id: { $in: startTimeZeroaudioClipIds },
      });

      await Promise.all(
        clipsToUpdate.map(async clip => {
          await clip.update({ start_time: clip.start_time + 1 });
        }),
      );

      return {
        data: [],
        message: 'Clip Start Times Updated. Success OK!',
      };
    } catch (err) {
      logger.error('Nudge start time error:', err);
      return {
        data: null,
        message: `Error nudging Clip Start Times: ${err}`,
      };
    }
  }

  static async getClipStartTime(clipId: string): Promise<ClipStartTimeResponse> {
    try {
      const clip = await MongoAudioClipsModel.findById(clipId);
      return {
        message: 'Success',
        data: clip.start_time.toFixed(2),
      };
    } catch (err) {
      logger.error('Get clip start time error:', err);
      return {
        message: `Unable to get clip start time: ${err}`,
        data: null,
      };
    }
  }

  static async updatePlaybackType(clipId: string, playbackType: 'extended' | 'inline') {
    try {
      const result = await MongoAudioClipsModel.updateOne({ _id: clipId }, { playback_type: playbackType });
      return {
        message: 'Updated Playback Type',
        data: result,
      };
    } catch (err) {
      logger.error('Update playback type error:', err);
      return {
        message: `Error in Updating Playback Type: ${err}`,
        data: null,
      };
    }
  }

  static async getOldAudioPath(clipId: string): Promise<AudioPathResponse> {
    try {
      const clip = await MongoAudioClipsModel.findById(clipId);
      if (!clip) {
        return {
          message: 'Clip not found',
          data: null,
        };
      }

      // Ensure proper path construction with file extension
      let filePath = clip.file_name ? `${clip.file_path}/${clip.file_name}` : clip.file_path;

      // Validate the file extension
      if (clip.file_name && !clip.file_name.endsWith('.mp3')) {
        filePath = filePath + '.mp3';
      }

      return {
        message: 'Success',
        data: filePath,
      };
    } catch (err) {
      logger.error('Get old audio path error:', err);
      return {
        message: `Unable to get old audio path: ${err}`,
        data: null,
      };
    }
  }

  static async getVideoFromYoutubeId(youtubeVideoId: string) {
    try {
      const video = await getYouTubeVideoStatus(youtubeVideoId);
      return {
        message: 'Success',
        data: video._id,
      };
    } catch (err) {
      logger.error('Get video from YouTube ID error:', err);
      return {
        message: `Error getting video: ${err}`,
        data: null,
      };
    }
  }
}

class ClipProcessingService {
  static async processCurrentClip(data: {
    textToSpeechOutput: TextToSpeechResponse;
    clip_id: string;
    video_id: string;
    ad_id: string;
  }): Promise<ProcessClipResponse> {
    if (!data.textToSpeechOutput.status) {
      return {
        clip_id: data.clip_id,
        message: 'Unable to generate Text to Speech',
      };
    }

    try {
      const clipPath = data.textToSpeechOutput.filename
        ? `${data.textToSpeechOutput.filepath}/${data.textToSpeechOutput.filename}`
        : data.textToSpeechOutput.filepath;

      const duration = await FileManagementService.getAudioDuration(clipPath);
      if (!duration.data) {
        return {
          clip_id: data.clip_id,
          message: duration.message,
        };
      }

      const startTime = await DatabaseService.getClipStartTime(data.clip_id);
      if (!startTime.data) {
        return {
          clip_id: data.clip_id,
          message: startTime.message,
        };
      }

      const clipStartTime = parseFloat(startTime.data);
      const clipDuration = parseFloat(duration.data);
      const clipEndTime = clipStartTime + clipDuration;

      await MongoAudioClipsModel.updateOne(
        { _id: data.clip_id },
        {
          start_time: clipStartTime,
          duration: clipDuration,
          end_time: clipEndTime,
          file_path: data.textToSpeechOutput.filepath,
          file_name: data.textToSpeechOutput.filename,
          file_mime_type: data.textToSpeechOutput.file_mime_type,
          file_size_bytes: data.textToSpeechOutput.file_size_bytes,
        },
      );

      const playbackType = await AudioClipService.analyzePlaybackType(clipStartTime, clipEndTime, data.video_id, data.ad_id, data.clip_id, true);

      if (!playbackType.data) {
        return {
          clip_id: data.clip_id,
          message: playbackType.message,
        };
      }

      await DatabaseService.updatePlaybackType(data.clip_id, playbackType.data);

      return {
        clip_id: data.clip_id,
        message: 'Success OK',
        playbackType: playbackType.data,
      };
    } catch (error) {
      logger.error('Process clip error:', error);
      return {
        clip_id: data.clip_id,
        message: `Processing error: ${error}`,
      };
    }
  }
}

// File Upload Configuration
export const upload = multer({
  storage: multer.diskStorage({
    filename: (req, _file, cb) => {
      const uniqueId = uuidv4();
      const newACType = req.body.newACType === 'Visual' ? 'nonOCR' : 'OCR';
      cb(null, `${newACType}-${uniqueId}.mp3`);
    },
    destination: (req, _file, cb) => {
      const audioDescriptionId = req.params.adId || req.body.audioDescriptionId;
      const dir = `${CONFIG.app.audioDirectory}/audio/${req.body.youtubeVideoId}/${audioDescriptionId}`;
      FileManagementService.ensureDirectoryExists(dir);
      cb(null, dir);
    },
  }),
});

// Deep copy functionality
class DeepCopyService {
  static async deepCopyAudioClip(
    audioDescriptionId: string,
    deepCopiedAudioDescriptionId: string,
    userIdTo: string,
    videoId: string,
  ): Promise<string[] | null> {
    try {
      const audioClips = await MongoAudioClipsModel.find({
        audio_description: audioDescriptionId,
      });

      const copiedClips = await Promise.all(
        audioClips.map(async audioClip => {
          const newPath = FileManagementService.copyFile(audioClip.file_path, videoId, audioClip.file_name, deepCopiedAudioDescriptionId);

          return MongoAudioClipsModel.create({
            description_type: audioClip.description_type || 'Visual',
            description_text: audioClip.description_text,
            playback_type: audioClip.playback_type,
            start_time: audioClip.start_time,
            end_time: audioClip.end_time,
            duration: audioClip.duration,
            file_path: newPath,
            file_name: audioClip.file_name,
            file_mime_type: audioClip.file_mime_type,
            file_size_bytes: audioClip.file_size_bytes,
            audio_description: deepCopiedAudioDescriptionId,
            user: userIdTo,
            video: audioClip.video,
            created_at: nowUtc(),
            updated_at: nowUtc(),
            transcript: audioClip.transcript,
            label: audioClip.label,
          });
        }),
      );

      return copiedClips.map(clip => clip._id);
    } catch (error) {
      logger.error('Deep copy error:', error);
      return null;
    }
  }
}

// Export all services
export { AudioClipService, DatabaseService, FileManagementService, ClipProcessingService, DeepCopyService };

// Export functions for backward compatibility
export const generateMp3forDescriptionText = async (
  adId: string,
  youtubeVideoId: string,
  clipDescriptionText: string,
  clipDescriptionType: string,
): Promise<TextToSpeechResponse> => {
  return AudioClipService.generateMp3forDescriptionText(adId, youtubeVideoId, clipDescriptionText, clipDescriptionType);
};

export const analyzePlaybackType = async (
  currentClipStartTime: number,
  currentClipEndTime: number,
  videoId: string,
  adId: string,
  clipId: string | null,
  processingAllClips: boolean,
  requestedPlaybackType?: 'extended' | 'inline',
): Promise<PlaybackAnalysisResponse> => {
  return AudioClipService.analyzePlaybackType(currentClipStartTime, currentClipEndTime, videoId, adId, clipId, processingAllClips, requestedPlaybackType);
};

export const getAudioDuration = async (filepath: string): Promise<{ message: string; data: string | null }> => {
  return FileManagementService.getAudioDuration(filepath);
};

export const deleteOldAudioFile = (filepath: string): boolean => {
  return FileManagementService.deleteFile(filepath);
};

export const nudgeStartTimeIfZero = async (audioClips: Audio_Clips[] | IAudioClip[]): Promise<NudgeStartTimeResult> => {
  return DatabaseService.nudgeStartTimeIfZero(audioClips);
};

export const getClipStartTimebyId = async (clipId: string): Promise<ClipStartTimeResponse> => {
  return DatabaseService.getClipStartTime(clipId);
};

export const getOldAudioFilePath = async (clipId: string): Promise<AudioPathResponse> => {
  return DatabaseService.getOldAudioPath(clipId);
};

export const getVideoFromYoutubeId = async (youtubeVideoId: string) => {
  return DatabaseService.getVideoFromYoutubeId(youtubeVideoId);
};

export const updatePlaybackinDB = async (clipId: string, playbackType: 'extended' | 'inline') => {
  return DatabaseService.updatePlaybackType(clipId, playbackType);
};

export const processCurrentClip = async (data: {
  textToSpeechOutput: TextToSpeechResponse;
  clip_id: string;
  video_id: string;
  ad_id: string;
}): Promise<ProcessClipResponse> => {
  return ClipProcessingService.processCurrentClip(data);
};

export const deepCopyAudioClip = async (
  audioDescriptionId: string,
  deepCopiedAudioDescriptionId: string,
  userIdTo: string,
  videoId: string,
): Promise<string[] | null> => {
  return DeepCopyService.deepCopyAudioClip(audioDescriptionId, deepCopiedAudioDescriptionId, userIdTo, videoId);
};

// Export types for external use
export type { TextToSpeechResponse, PlaybackAnalysisResponse, ClipStartTimeResponse, AudioPathResponse, ProcessClipResponse, NudgeStartTimeResult };
