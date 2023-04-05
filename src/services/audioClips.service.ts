import { AddNewAudioClipDto, UpdateAudioClipDescriptionDto, UpdateAudioClipStartTimeDto, UpdateClipAudioPathDto } from '../dtos/audioClips.dto';
import { CURRENT_DATABASE } from '../config';
import { HttpException } from '../exceptions/HttpException';
import { Audio_ClipsAttributes, Audio_Descriptions, PostGres_Audio_Clips, Videos } from '../models/postgres/init-models';
import { isEmpty } from '../utils/util';
import {
  analyzePlaybackType,
  deleteOldAudioFile,
  generateMp3forDescriptionText,
  getAudioDuration,
  getClipStartTimebyId,
  getOldAudioFilePath,
  getVideoFromYoutubeId,
  nudgeStartTimeIfZero,
  processCurrentClip,
} from './audioClips.util';
import { logger } from '../utils/logger';
import { MongoAudioClipsModel, MongoAudio_Descriptions_Model, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import mongoose, { Types } from 'mongoose';
import { IAudioDescription } from '../models/mongodb/AudioDescriptions.mongo';

interface IProcessedClips {
  clip_id: any;
  message: string;
  playbackType?: 'extended' | 'inline';
}

interface IAudioDescriptionsWithADID extends Audio_ClipsAttributes {
  Audio_Description: {
    VideoVideoId: any;
    UserUserId: any;
    Video: {
      youtube_video_id: any;
      video_length: any;
    };
  };
}

// interface PopulatedAudioDescription {
//   UserUserId: Types.ObjectId;
//   VideoVideoId: Types.ObjectId;
//   Video: {
//     youtube_video_id: string;
//     video_length: number;
//   };
// }

interface PopulatedAudioDescription extends IAudioClip {
  Audio_Description: {
    user: any;
    video: any;
    Video: {
      youtube_id: any;
      duration: any;
    };
  };
}

// interface PopulatedAudioClip {
//   clip_id: string;
//   description_type: string;
//   description_text: string;
//   AudioDescriptionAdId: Types.ObjectId;
//   Audio_Description: PopulatedAudioDescription;
// }

interface IProcessedClips {
  message: string;
}
class AudioClipsService {
  public async processAllClipsInDB(audioDescriptionAdId: string): Promise<IProcessedClips[]> {
    if (isEmpty(audioDescriptionAdId)) throw new HttpException(400, 'Audio Description ID is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const audioDescriptions = await MongoAudioClipsModel.find({
        audio_description: audioDescriptionAdId,
      });
      if (!audioDescriptions) throw new HttpException(409, "Audio Descriptions couldn't be found");
      const populatedAudioClip: PopulatedAudioDescription[] = [];
      for (let i = 0; i < audioDescriptions.length; i++) {
        const audioDescription: IAudioClip = audioDescriptions[i];
        const populatedAudioDescription = await MongoAudio_Descriptions_Model.findById(audioDescription.audio_description);
        const populatedVideo = await MongoVideosModel.findById(populatedAudioDescription.video);
        const obj = {
          _id: audioDescription._id,
          audio_description: audioDescription.audio_description,
          created_at: audioDescription.created_at,
          description_type: audioDescription.description_type,
          description_text: audioDescription.description_text,
          label: audioDescription.label,
          playback_type: audioDescription.playback_type,
          start_time: audioDescription.start_time,
          transcript: audioDescription.transcript,
          updated_at: audioDescription.updated_at,
          user: audioDescription.user,
          video: audioDescription.video,
          Audio_Description: {
            user: populatedAudioDescription.user,
            video: populatedAudioDescription.video,
            Video: {
              youtube_id: populatedVideo.youtube_id,
              duration: populatedVideo.duration,
            },
          },
        } as PopulatedAudioDescription;
        populatedAudioClip.push(obj);
      }

      const nudgeStatus = await nudgeStartTimeIfZero(populatedAudioClip);
      if (nudgeStatus.data === null) throw new HttpException(409, nudgeStatus.message);
      const descriptionTexts = populatedAudioClip.map(clip => {
        const typeCastedClip = clip;
        return {
          clip_id: typeCastedClip._id,
          clip_description_type: typeCastedClip.description_type,
          clip_description_text: typeCastedClip.description_text,
          video_id: typeCastedClip.Audio_Description.video._id,
          user_id: typeCastedClip.Audio_Description.user._id,
          youtube_id: typeCastedClip.Audio_Description.Video.youtube_id,
          video_length: typeCastedClip.Audio_Description.Video.duration,
        };
      });
      const statusData = [];

      for (let index = 0; index < descriptionTexts.length; index++) {
        const desc = descriptionTexts[index];
        const textToSpeechOutput = await generateMp3forDescriptionText(desc.user_id, desc.youtube_id, desc.clip_description_text, desc.clip_description_type);
        const data = {
          textToSpeechOutput,
          clip_id: desc.clip_id,
          video_id: desc.video_id,
          ad_id: audioDescriptionAdId,
          description_type: desc.clip_description_type,
          video_length: desc.video_length,
        };
        statusData.push(data);
      }

      if (statusData.some(data => !data.textToSpeechOutput.status)) throw new HttpException(409, "Audio Descriptions couldn't be generated");
      const updateStatusOfAllClips: IProcessedClips[] = [];
      await Promise.all(
        statusData.map(async data => {
          logger.info('Yet to update data in DB');
          // to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table
          const updateStatus = await processCurrentClip(data);
          // get the status message and push it to an array
          updateStatusOfAllClips.push(updateStatus);
        }),
      );
      if (!updateStatusOfAllClips) throw new HttpException(409, "Audio Descriptions couldn't be updated");
      return updateStatusOfAllClips;
    } else {
      const audioDescriptions = await PostGres_Audio_Clips.findAll({
        where: {
          AudioDescriptionAdId: audioDescriptionAdId,
        },
        // nesting the associations to fetch userID, videoID, YoutubeVideoID - eager loading example
        include: [
          {
            model: Audio_Descriptions,
            attributes: ['UserUserId', 'VideoVideoId'],
            as: 'Audio_Description',
            include: [
              {
                model: Videos,
                attributes: ['youtube_video_id', 'video_length'],
                as: 'Videos',
              },
            ],
          },
        ],
        logging: false,
      });
      if (!audioDescriptions) throw new HttpException(409, "Audio Descriptions couldn't be found");
      const nudgeStatus = await nudgeStartTimeIfZero(audioDescriptions);
      if (nudgeStatus.data === null) throw new HttpException(409, nudgeStatus.message);
      const descriptionTexts = audioDescriptions.map(clip => {
        const typeCastedClip = clip as unknown as IAudioDescriptionsWithADID;
        return {
          clip_id: typeCastedClip.clip_id,
          clip_description_type: typeCastedClip.description_type,
          clip_description_text: typeCastedClip.description_text,
          video_id: typeCastedClip.Audio_Description.VideoVideoId,
          user_id: typeCastedClip.Audio_Description.UserUserId,
          youtube_id: typeCastedClip.Audio_Description.Video.youtube_video_id,
          video_length: typeCastedClip.Audio_Description.Video.video_length,
        };
      });
      const statusData = [];
      const generateMp3Status = await Promise.all(
        descriptionTexts.map(async desc => {
          const data = {
            textToSpeechOutput: await generateMp3forDescriptionText(desc.user_id, desc.youtube_id, desc.clip_description_text, desc.clip_description_type),
            clip_id: desc.clip_id,
            video_id: desc.video_id,
            ad_id: audioDescriptionAdId,
            description_type: desc.clip_description_type,
            video_length: desc.video_length,
          };
          statusData.push(data);
        }),
      );
      if (!generateMp3Status) throw new HttpException(409, "Audio Descriptions couldn't be generated");
      const updateStatusOfAllClips: IProcessedClips[] = [];
      await Promise.all(
        statusData.map(async data => {
          logger.info('Yet to update data in DB');
          // to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table
          const updateStatus = await processCurrentClip(data);
          // get the status message and push it to an array
          updateStatusOfAllClips.push(updateStatus);
        }),
      );
      if (!updateStatusOfAllClips) throw new HttpException(409, "Audio Descriptions couldn't be updated");
      return updateStatusOfAllClips;
    }
  }

  public async updateAudioClipTitle(clipId: string, adTitle: string): Promise<number[]> {
    if (isEmpty(clipId)) throw new HttpException(400, 'Clip ID is empty');
    if (isEmpty(adTitle)) throw new HttpException(400, 'Audio Title is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const updatedClipId = await MongoAudioClipsModel.updateMany(
        {
          _id: clipId,
        },
        {
          $set: { label: adTitle },
        },
      );
      if (!updatedClipId) throw new HttpException(409, "Audio Description couldn't be updated");
      return [updatedClipId.matchedCount, updatedClipId.modifiedCount, updatedClipId.upsertedCount];
    } else {
      const updatedClipId = await PostGres_Audio_Clips.update(
        {
          clip_title: adTitle,
        },
        {
          where: {
            clip_id: clipId,
          },
        },
      );
      if (!updatedClipId) throw new HttpException(409, "Audio Description couldn't be updated");
      return updatedClipId;
    }
  }

  public async updateAudioClipPlaybackType(clipId: string, clipPlaybackType: string): Promise<number[]> {
    if (isEmpty(clipId)) throw new HttpException(400, 'Clip ID is empty');
    if (isEmpty(clipPlaybackType)) throw new HttpException(400, 'Clip Playback Type is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const updatedAudioClipType = await MongoAudioClipsModel.updateMany(
        {
          _id: clipId,
        },
        {
          $set: { playback_type: clipPlaybackType },
        },
      );
      if (!updatedAudioClipType) throw new HttpException(409, "Audio Description couldn't be updated");
      return [updatedAudioClipType.matchedCount, updatedAudioClipType.modifiedCount, updatedAudioClipType.upsertedCount];
    } else {
      const updatedAudioClipType = await PostGres_Audio_Clips.update(
        {
          playback_type: clipPlaybackType,
        },
        {
          where: {
            clip_id: clipId,
          },
        },
      );
      if (!updatedAudioClipType) throw new HttpException(409, "Audio Description couldn't be updated");
      return updatedAudioClipType;
    }
  }

  public async updateAudioClipStartTime(clipId: string, audioBody: UpdateAudioClipStartTimeDto): Promise<number[]> {
    const { youtubeVideoId, clipStartTime, audioDescriptionId } = audioBody;

    if (isEmpty(clipId)) throw new HttpException(400, 'Clip ID is empty');
    if (isEmpty(youtubeVideoId)) throw new HttpException(400, 'Youtube Video ID is empty');
    if (isEmpty(clipStartTime)) throw new HttpException(400, 'Clip Start Time is empty');
    if (isEmpty(audioDescriptionId)) throw new HttpException(400, 'Audio Description ID is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const audioClip = await MongoAudioClipsModel.findById(clipId);
      if (!audioClip) throw new HttpException(409, "Audio Description couldn't be found");
      const videoIdStatus = await getVideoFromYoutubeId(youtubeVideoId);
      if (videoIdStatus.data === null) throw new HttpException(409, videoIdStatus.message);
      const clipEndTime = Number(parseFloat(Number(parseFloat(clipStartTime) + audioClip.duration).toFixed(2)));
      const videoId = videoIdStatus.data;
      const playbackTypeStatus = await analyzePlaybackType(
        Number(clipStartTime),
        clipEndTime,
        videoId,
        audioDescriptionId,
        clipId,
        false, // passing false, as this is a single clip process
      );

      if (playbackTypeStatus.data === null) throw new HttpException(500, playbackTypeStatus.message);
      const playbackType = playbackTypeStatus.data;
      const updatedAudioClipStartTime = await MongoAudioClipsModel.updateMany(
        {
          _id: clipId,
        },
        {
          $set: { start_time: clipStartTime, playback_type: playbackType, end_time: clipEndTime },
        },
      );
      if (!updatedAudioClipStartTime) throw new HttpException(409, "Audio Description couldn't be updated");
      return [updatedAudioClipStartTime.matchedCount, updatedAudioClipStartTime.modifiedCount, updatedAudioClipStartTime.upsertedCount];
    } else {
      const audioClip = await PostGres_Audio_Clips.findOne({
        where: {
          clip_id: clipId,
        },
        attributes: ['clip_duration'],
      });
      if (!audioClip) throw new HttpException(409, "Audio Description couldn't be found");
      const videoIdStatus = await getVideoFromYoutubeId(youtubeVideoId);
      if (videoIdStatus.data === null) throw new HttpException(409, videoIdStatus.message);
      const clipEndTime = Number(parseFloat(Number(parseFloat(clipStartTime) + audioClip.clip_duration).toFixed(2)));
      const videoId = videoIdStatus.data;
      const playbackTypeStatus = await analyzePlaybackType(
        Number(clipStartTime),
        clipEndTime,
        videoId,
        audioDescriptionId,
        clipId,
        false, // passing false, as this is a single clip process
      );

      if (playbackTypeStatus.data === null) throw new HttpException(500, playbackTypeStatus.message);
      const playbackType = playbackTypeStatus.data;
      const updatedAudioClip = PostGres_Audio_Clips.update(
        {
          clip_start_time: Number(clipStartTime),
          clip_end_time: clipEndTime,
          playback_type: playbackType,
        },
        {
          where: {
            clip_id: clipId,
          },
        },
      );
      if (!updatedAudioClip) throw new HttpException(409, "Audio Description couldn't be updated");
      return updatedAudioClip;
    }
  }

  public async updateAudioClipDescription(clipId: string, audioBody: UpdateAudioClipDescriptionDto): Promise<number[]> {
    const { youtubeVideoId, clipDescriptionText, clipDescriptionType, userId, audioDescriptionId } = audioBody;

    if (isEmpty(clipId)) throw new HttpException(400, 'Clip ID is empty');
    if (isEmpty(youtubeVideoId)) throw new HttpException(400, 'Youtube Video ID is empty');
    if (isEmpty(clipDescriptionText)) throw new HttpException(400, 'Clip Description Text is empty');
    if (isEmpty(clipDescriptionType)) throw new HttpException(400, 'Clip Description Type is empty');
    if (isEmpty(userId)) throw new HttpException(400, 'User ID is empty');
    if (isEmpty(audioDescriptionId)) throw new HttpException(400, 'Audio Description ID is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const generatedMP3Response = await generateMp3forDescriptionText(userId, youtubeVideoId, clipDescriptionText, clipDescriptionType);
      if (generatedMP3Response.filepath === null) throw new HttpException(409, "Audio Description couldn't be generated");
      const newAudioClipPath = generatedMP3Response.filepath;
      const oldAudioFilePathStatus = await getOldAudioFilePath(clipId);
      if (oldAudioFilePathStatus.data === null) throw new HttpException(409, oldAudioFilePathStatus.message);
      const clipDurationStatus = await getAudioDuration(newAudioClipPath);
      if (clipDurationStatus.data === null) throw new HttpException(409, clipDurationStatus.message);
      const getVideoIdStatus = await getVideoFromYoutubeId(youtubeVideoId);
      if (getVideoIdStatus.data === null) throw new HttpException(409, getVideoIdStatus.message);
      const videoId = getVideoIdStatus.data;
      const getClipStartTimeStatus = await getClipStartTimebyId(clipId);
      if (getClipStartTimeStatus.data === null) throw new HttpException(409, getClipStartTimeStatus.message);
      const clipStartTime = getClipStartTimeStatus.data;
      const updatedAudioDuration = clipDurationStatus.data;
      const updatedClipEndTime = Number((parseFloat(clipStartTime) + parseFloat(updatedAudioDuration)).toFixed(2));
      const playbackTypeStatus = await analyzePlaybackType(
        clipStartTime,
        updatedClipEndTime,
        videoId,
        audioDescriptionId,
        clipId,
        false, // passing false, as this is a single clip process
      );
      if (playbackTypeStatus.data === null) throw new HttpException(409, playbackTypeStatus.message);
      const playbackType = playbackTypeStatus.data;
      const oldAudioFilePath = oldAudioFilePathStatus.data;

      const updatedAudioClip = await MongoAudioClipsModel.updateMany(
        {
          _id: clipId,
        },
        {
          $set: {
            description: clipDescriptionText,
            file_path: newAudioClipPath,
            duration: updatedAudioDuration,
            end_time: updatedClipEndTime,
            playback_type: playbackType,
          },
        },
      );
      if (!updatedAudioClip) throw new HttpException(409, "Audio Description couldn't be updated");
      const deletedFile = await deleteOldAudioFile(oldAudioFilePath);
      if (!deletedFile) throw new HttpException(409, "Old Audio File couldn't be deleted");
      return [updatedAudioClip.matchedCount, updatedAudioClip.modifiedCount, updatedAudioClip.upsertedCount];
    } else {
      const generatedMP3Response = await generateMp3forDescriptionText(userId, youtubeVideoId, clipDescriptionText, clipDescriptionType);
      if (generatedMP3Response.filepath === null) throw new HttpException(409, "Audio Description couldn't be generated");
      const newAudioClipPath = generatedMP3Response.filepath;
      const oldAudioFilePathStatus = await getOldAudioFilePath(clipId);
      if (oldAudioFilePathStatus.data === null) throw new HttpException(409, oldAudioFilePathStatus.message);
      const clipDurationStatus = await getAudioDuration(newAudioClipPath);
      if (clipDurationStatus.data === null) throw new HttpException(409, clipDurationStatus.message);
      const getVideoIdStatus = await getVideoFromYoutubeId(youtubeVideoId);
      if (getVideoIdStatus.data === null) throw new HttpException(409, getVideoIdStatus.message);
      const videoId = getVideoIdStatus.data;
      const getClipStartTimeStatus = await getClipStartTimebyId(clipId);
      if (getClipStartTimeStatus.data === null) throw new HttpException(409, getClipStartTimeStatus.message);
      const clipStartTime = getClipStartTimeStatus.data;
      const updatedAudioDuration = clipDurationStatus.data;
      const updatedClipEndTime = Number((parseFloat(clipStartTime) + parseFloat(updatedAudioDuration)).toFixed(2));
      const playbackTypeStatus = await analyzePlaybackType(
        clipStartTime,
        updatedClipEndTime,
        videoId,
        audioDescriptionId,
        clipId,
        false, // passing false, as this is a single clip process
      );
      if (playbackTypeStatus.data === null) throw new HttpException(409, playbackTypeStatus.message);
      const playbackType = playbackTypeStatus.data;
      const oldAudioFilePath = oldAudioFilePathStatus.data;

      const updatedAudioClip = await PostGres_Audio_Clips.update(
        {
          clip_audio_path: newAudioClipPath,
          description_text: clipDescriptionText,
          clip_duration: Number(parseFloat(updatedAudioDuration).toFixed(2)),
          clip_end_time: updatedClipEndTime,
          playback_type: playbackType,
          is_recorded: false, // since the description is modified, it is not a recorded audio clip
        },
        {
          where: {
            clip_id: clipId,
          },
        },
      );
      if (!updatedAudioClip) throw new HttpException(409, "Audio Description couldn't be updated");
      const deletedFile = await deleteOldAudioFile(oldAudioFilePath);
      if (!deletedFile) throw new HttpException(409, "Audio Description couldn't be updated");
      return updatedAudioClip;
    }
  }

  public async updateClipAudioPath(clipId: string, audioBody: UpdateClipAudioPathDto, file: Express.Multer.File): Promise<number[]> {
    const { youtubeVideoId, clipDescriptionText, audioDescriptionId, clipStartTime, recordedClipDuration } = audioBody;

    if (isEmpty(clipId)) throw new HttpException(400, 'Clip ID is empty');
    if (isEmpty(youtubeVideoId)) throw new HttpException(400, 'Youtube Video ID is empty');
    if (isEmpty(clipDescriptionText)) throw new HttpException(400, 'Clip Description Text is empty');
    if (isEmpty(clipStartTime)) throw new HttpException(400, 'Clip Start Time is empty');
    if (isEmpty(recordedClipDuration)) throw new HttpException(400, 'Recorded Clip Duration is empty');
    if (isEmpty(audioDescriptionId)) throw new HttpException(400, 'Audio Description ID is empty');
    if (file === undefined) throw new HttpException(400, 'Audio File is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const filePath = String(file.path);
      const clipAudioFilePath = `.` + filePath.substring(filePath.indexOf('/audio/'));
      logger.info(`Database Updated Audio Clip Path: ${clipAudioFilePath}`);

      const newClipEndTime = Number((parseFloat(clipStartTime) + parseFloat(recordedClipDuration)).toFixed(2));
      const videoIdStatus = await getVideoFromYoutubeId(youtubeVideoId);
      if (videoIdStatus.data === null) throw new HttpException(409, videoIdStatus.message);
      const videoId = videoIdStatus.data;
      const playbackTypeStatus = await analyzePlaybackType(
        Number(clipStartTime),
        newClipEndTime,
        videoId,
        audioDescriptionId,
        clipId,
        false, // passing false, as this is a single clip process
      );
      if (playbackTypeStatus.data === null) throw new HttpException(409, playbackTypeStatus.message);
      const oldAudioFilePathStatus = await getOldAudioFilePath(clipId);
      if (oldAudioFilePathStatus.data === null) throw new HttpException(409, oldAudioFilePathStatus.message);
      const old_audio_path = oldAudioFilePathStatus.data;
      const deleteOldAudioFileStatus = await deleteOldAudioFile(old_audio_path);
      if (!deleteOldAudioFileStatus) throw new HttpException(409, 'Problem Saving Audio!! Please try again');
      const newPlaybackType = playbackTypeStatus.data;

      const updatedAudioClip = await MongoAudioClipsModel.updateMany(
        {
          _id: clipId,
        },
        {
          $set: {
            playback_type: newPlaybackType,
            end_time: newClipEndTime,
            duration: Number(recordedClipDuration),
            file_path: clipAudioFilePath,
            description_text: clipDescriptionText,
          },
        },
      );
      if (!updatedAudioClip) throw new HttpException(409, 'Problem Saving Audio!! Please try again');
      return [updatedAudioClip.matchedCount, updatedAudioClip.modifiedCount, updatedAudioClip.upsertedCount];
    } else {
      // All audio clip paths have the ./audio/ prefix so, need to find /audio/ and then add a . to the beginning
      const filePath = String(file.path);
      const clipAudioFilePath = `.` + filePath.substring(filePath.indexOf('/audio/'));
      logger.info(`Database Updated Audio Clip Path: ${clipAudioFilePath}`);

      const newClipEndTime = Number((parseFloat(clipStartTime) + parseFloat(recordedClipDuration)).toFixed(2));
      const videoIdStatus = await getVideoFromYoutubeId(youtubeVideoId);
      if (videoIdStatus.data === null) throw new HttpException(409, videoIdStatus.message);
      const videoId = videoIdStatus.data;
      const playbackTypeStatus = await analyzePlaybackType(
        Number(clipStartTime),
        newClipEndTime,
        videoId,
        audioDescriptionId,
        clipId,
        false, // passing false, as this is a single clip process
      );
      if (playbackTypeStatus.data === null) throw new HttpException(409, playbackTypeStatus.message);
      const oldAudioFilePathStatus = await getOldAudioFilePath(clipId);
      if (oldAudioFilePathStatus.data === null) throw new HttpException(409, oldAudioFilePathStatus.message);
      const old_audio_path = oldAudioFilePathStatus.data;
      const deleteOldAudioFileStatus = await deleteOldAudioFile(old_audio_path);
      if (!deleteOldAudioFileStatus) throw new HttpException(409, 'Problem Saving Audio!! Please try again');
      const newPlaybackType = playbackTypeStatus.data;
      const updatedAudioClips = PostGres_Audio_Clips.update(
        {
          playback_type: newPlaybackType,
          clip_end_time: newClipEndTime,
          clip_duration: Number(recordedClipDuration),
          clip_audio_path: clipAudioFilePath,
          is_recorded: true,
          description_text: clipDescriptionText,
        },
        {
          where: {
            clip_id: clipId,
          },
        },
      );
      if (!updatedAudioClips) throw new HttpException(409, "Audio Description couldn't be updated");
      return updatedAudioClips;
    }
  }

  public async addNewAudioClip(adId: string, audioBody: AddNewAudioClipDto, file: Express.Multer.File | null): Promise<string> {
    const { isRecorded, newACDescriptionText, newACPlaybackType, newACStartTime, newACTitle, newACType, newACDuration, userId, youtubeVideoId } = audioBody;

    if (isEmpty(adId)) throw new HttpException(400, 'Clip ID is empty');
    if (isEmpty(userId)) throw new HttpException(400, 'User ID is empty');
    if (isEmpty(newACStartTime)) throw new HttpException(400, 'New Audio Clip Start Time is empty');
    if (isEmpty(newACTitle)) throw new HttpException(400, 'New Audio Clip Title is empty');
    if (isEmpty(newACType)) throw new HttpException(400, 'New Audio Clip Type is empty');
    if (isEmpty(newACDescriptionText)) throw new HttpException(400, 'New Audio Clip Description Text is empty');
    if (isEmpty(newACPlaybackType)) throw new HttpException(400, 'New Audio Clip Playback Type is empty');
    if (CURRENT_DATABASE == 'mongodb') {
      let newClipAudioFilePath: string;
      let newAudioDuration: string;
      if (file && isRecorded && newACDuration !== null) {
        newClipAudioFilePath = String(file.path).split('\\').join('/').replace('public', '.');
        newAudioDuration = newACDuration;
      }
      const generatedMP3Response = await generateMp3forDescriptionText(userId, youtubeVideoId, newACDescriptionText, newACType);
      if (generatedMP3Response.status === null) throw new HttpException(409, 'Unable to generate Text to Speech!! Please try again');
      newClipAudioFilePath = generatedMP3Response.filepath;
      const clipDurationStatus = await getAudioDuration(newClipAudioFilePath);
      if (clipDurationStatus.data === null) throw new HttpException(409, clipDurationStatus.message);
      newAudioDuration = clipDurationStatus.data;
      const newClipEndTime = Number((parseFloat(newACStartTime) + parseFloat(newAudioDuration)).toFixed(2));
      const getVideoIdStatus = await getVideoFromYoutubeId(youtubeVideoId);
      if (getVideoIdStatus.data === null) throw new HttpException(409, getVideoIdStatus.message);
      const videoId = getVideoIdStatus.data;
      const playbackTypeStatus = await analyzePlaybackType(
        Number(parseFloat(newACStartTime).toFixed(2)),
        newClipEndTime,
        videoId,
        adId,
        null, // see condition in method - sends null for clipId
        false, // passing false, as this is a single clip process
      );
      if (playbackTypeStatus.data === null) throw new HttpException(409, playbackTypeStatus.message);
      const newPlaybackType = playbackTypeStatus.data;
      const newAudioClip = await MongoAudioClipsModel.create({
        description_type: newACType,
        description_text: newACDescriptionText,
        playback_type: newPlaybackType,
        start_time: Number(parseFloat(newACStartTime).toFixed(2)),
        end_time: newClipEndTime,
        duration: Number(newAudioDuration),
        file_path: newClipAudioFilePath,
        audio_description: adId,
        user: userId,
        video: videoId,
        created_at: new Date(),
        updated_at: new Date(),
        transcript: [],
        label: newACTitle,
      });
      if (!newAudioClip) throw new HttpException(409, "Audio Description couldn't be created");
      const playBackTypeMsg = newPlaybackType === newACPlaybackType ? '' : `Note: The playback type of the new clip is modified to ${newPlaybackType}`;
      return playBackTypeMsg;
    } else {
      let newClipAudioFilePath: string;
      let newAudioDuration: string;
      if (file && isRecorded && newACDuration !== null) {
        newClipAudioFilePath = String(file.path).split('\\').join('/').replace('public', '.');
        newAudioDuration = newACDuration;
      }
      const generatedMP3Response = await generateMp3forDescriptionText(userId, youtubeVideoId, newACDescriptionText, newACType);
      if (generatedMP3Response.status === null) throw new HttpException(409, 'Unable to generate Text to Speech!! Please try again');
      newClipAudioFilePath = generatedMP3Response.filepath;
      const clipDurationStatus = await getAudioDuration(newClipAudioFilePath);
      if (clipDurationStatus.data === null) throw new HttpException(409, clipDurationStatus.message);
      newAudioDuration = clipDurationStatus.data;
      const newClipEndTime = Number((parseFloat(newACStartTime) + parseFloat(newAudioDuration)).toFixed(2));
      const getVideoIdStatus = await getVideoFromYoutubeId(youtubeVideoId);
      if (getVideoIdStatus.data === null) throw new HttpException(409, getVideoIdStatus.message);
      const videoId = getVideoIdStatus.data;
      const playbackTypeStatus = await analyzePlaybackType(
        Number(parseFloat(newACStartTime).toFixed(2)),
        newClipEndTime,
        videoId,
        adId,
        null, // see condition in method - sends null for clipId
        false, // passing false, as this is a single clip process
      );
      if (playbackTypeStatus.data === null) throw new HttpException(409, playbackTypeStatus.message);
      const newPlaybackType = playbackTypeStatus.data;
      const newAudioClip = await PostGres_Audio_Clips.create({
        clip_title: newACTitle,
        description_type: newACType,
        description_text: newACDescriptionText,
        playback_type: newPlaybackType,
        clip_start_time: Number(parseFloat(newACStartTime).toFixed(2)),
        clip_end_time: newClipEndTime,
        clip_duration: Number(newAudioDuration),
        clip_audio_path: newClipAudioFilePath,
        is_recorded: isRecorded,
        AudioDescriptionAdId: adId,
      });
      if (!newAudioClip) throw new HttpException(409, "Audio Description couldn't be created");
      const playBackTypeMsg = newPlaybackType === newACPlaybackType ? '' : `Note: The playback type of the new clip is modified to ${newPlaybackType}`;
      return playBackTypeMsg;
    }
  }

  public async deleteAudioClip(clipId: string): Promise<number> {
    if (!clipId) {
      throw new HttpException(400, 'Clip ID is empty');
    }

    try {
      const oldAudioFilePathStatus = await getOldAudioFilePath(clipId);
      if (oldAudioFilePathStatus.data === null) {
        throw new HttpException(409, oldAudioFilePathStatus.message);
      }

      const oldAudioPath = oldAudioFilePathStatus.data;

      const deleteOldAudioFileStatus = await deleteOldAudioFile(oldAudioPath);
      if (!deleteOldAudioFileStatus) {
        throw new HttpException(409, 'Problem saving audio. Please try again.');
      }

      let deletedAudioClip;
      if (CURRENT_DATABASE === 'mongodb') {
        deletedAudioClip = await MongoAudioClipsModel.findByIdAndDelete(clipId);
      } else {
        deletedAudioClip = await PostGres_Audio_Clips.destroy({
          where: { clip_id: clipId },
        });
      }

      if (!deletedAudioClip) {
        throw new HttpException(409, "Audio description couldn't be deleted.");
      }

      return deletedAudioClip;
    } catch (error) {
      throw new HttpException(error.statusCode || 500, error.message);
    }
  }
}

export default AudioClipsService;
