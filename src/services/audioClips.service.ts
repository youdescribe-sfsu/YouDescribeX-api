import { AddNewAudioClipDto, UpdateAudioClipDescriptionDto, UpdateAudioClipStartTimeDto, UpdateClipAudioPathDto } from '../dtos/audioClips.dto';
import { CURRENT_DATABASE } from '../config';
import { HttpException } from '../exceptions/HttpException';
import { Audio_ClipsAttributes, Audio_Descriptions, PostGres_Audio_Clips, Videos } from '../models/postgres/init-models';
import { isEmpty, nowUtc } from '../utils/util';
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
import { MongoAudio_Descriptions_Model, MongoAudioClipsModel, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import { isVideoAvailable } from './videos.util';
import { Document } from 'mongoose';

type AudioClipDocument = IAudioClip & Document;

const userUndoStacks: { [userId: string]: { [videoId: string]: AudioClipDocument[] } } = {};

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

        const youtubeVideoData = await isVideoAvailable(populatedVideo.youtube_id);
        if (!youtubeVideoData) {
          throw new HttpException(400, 'No youtubeVideoData provided');
        }

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
        const textToSpeechOutput = await generateMp3forDescriptionText(
          audioDescriptionAdId,
          desc.youtube_id,
          desc.clip_description_text,
          desc.clip_description_type,
        );
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
            textToSpeechOutput: await generateMp3forDescriptionText(
              audioDescriptionAdId,
              desc.youtube_id,
              desc.clip_description_text,
              desc.clip_description_type,
            ),
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

      console.log('playbackTypeStatus', playbackTypeStatus);

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

    const generatedMP3Response = await generateMp3forDescriptionText(audioDescriptionId, youtubeVideoId, clipDescriptionText, clipDescriptionType);
    if (generatedMP3Response.filepath === null) throw new HttpException(409, "Audio Description couldn't be generated");
    const newAudioClipPath = generatedMP3Response.filepath;
    const newAudioClipName = generatedMP3Response.filename;
    const fullAudioClipPath = newAudioClipName == null || newAudioClipName.length <= 0 ? newAudioClipPath : newAudioClipPath + '/' + newAudioClipName;
    const oldAudioFilePathStatus = await getOldAudioFilePath(clipId);
    if (oldAudioFilePathStatus.data === null) throw new HttpException(409, oldAudioFilePathStatus.message);
    const clipDurationStatus = await getAudioDuration(fullAudioClipPath);
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

    if (CURRENT_DATABASE == 'mongodb') {
      const updatedAudioClip = await MongoAudioClipsModel.updateOne(
        {
          _id: clipId,
        },
        {
          $set: {
            description_text: clipDescriptionText,
            file_path: newAudioClipPath,
            duration: updatedAudioDuration,
            end_time: updatedClipEndTime,
            playback_type: playbackType,
            file_name: generatedMP3Response.filename,
            file_mime_type: generatedMP3Response.file_mime_type,
            file_size_bytes: generatedMP3Response.file_size_bytes,
            is_recorded: false,
          },
        },
      );
      if (!updatedAudioClip) throw new HttpException(409, "Audio Description couldn't be updated");
      const deletedFile = await deleteOldAudioFile(oldAudioFilePath);
      if (!deletedFile) throw new HttpException(409, "Old Audio File couldn't be deleted");
      return [updatedAudioClip.matchedCount, updatedAudioClip.modifiedCount, updatedAudioClip.upsertedCount];
    } else {
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
    const fileName = String(file.filename);
    const filePath = String(file.path);
    const file_mime_type = file.mimetype;
    const file_size_bytes = file.size;
    let clipAudioFilePath = `.` + filePath.substring(filePath.indexOf('/audio/'));
    if (clipAudioFilePath.includes('.mp3')) {
      clipAudioFilePath = clipAudioFilePath.split('/').slice(0, -1).join('/');
    }
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

    if (CURRENT_DATABASE == 'mongodb') {
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
            file_name: fileName,
            file_mime_type: file_mime_type,
            file_size_bytes: file_size_bytes,
            description_text: clipDescriptionText,
            is_recorded: true,
          },
        },
      );
      if (!updatedAudioClip) throw new HttpException(409, 'Problem Saving Audio!! Please try again');
      return [updatedAudioClip.matchedCount, updatedAudioClip.modifiedCount, updatedAudioClip.upsertedCount];
    } else {
      // All audio clip paths have the ./audio/ prefix so, need to find /audio/ and then add a . to the beginning
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
    if (isEmpty(newACPlaybackType)) throw new HttpException(400, 'New Audio Clip Playback Type is empty');

    let newClipAudioFilePath: string;
    let newAudioDuration: string;
    let fileName: string;
    let file_size_bytes: number;
    let file_mime_type: string;

    if (file && isRecorded && newACDuration !== null) {
      const filePath = String(file.path);
      newClipAudioFilePath = `.` + filePath.substring(filePath.indexOf('/audio/'));
      if (newClipAudioFilePath.includes('.mp3')) {
        newClipAudioFilePath = newClipAudioFilePath.split('/').slice(0, -1).join('/');
      }
      newAudioDuration = newACDuration;
      fileName = String(file.filename);
      file_size_bytes = file.size;
      file_mime_type = file.mimetype;
    } else {
      // User didn't record an audio clip, need to generate it using text-to-speech
      if (isEmpty(newACDescriptionText)) throw new HttpException(400, 'New Audio Clip Description Text is empty');
      const generatedMP3Response = await generateMp3forDescriptionText(adId, youtubeVideoId, newACDescriptionText, newACType);
      if (generatedMP3Response.status === null) throw new HttpException(409, 'Unable to generate Text to Speech!! Please try again');
      newClipAudioFilePath = generatedMP3Response.filepath;
      const newAudioClipName = generatedMP3Response.filename;
      const fullAudioClipPath = newAudioClipName == null || newAudioClipName.length <= 0 ? newClipAudioFilePath : newClipAudioFilePath + '/' + newAudioClipName;
      const clipDurationStatus = await getAudioDuration(fullAudioClipPath);
      if (clipDurationStatus.data === null) throw new HttpException(409, clipDurationStatus.message);
      newAudioDuration = clipDurationStatus.data;
      fileName = generatedMP3Response.filename;
      file_size_bytes = generatedMP3Response.file_size_bytes;
      file_mime_type = generatedMP3Response.file_mime_type;
    }

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

    if (CURRENT_DATABASE == 'mongodb') {
      const newAudioClip = await MongoAudioClipsModel.create({
        description_type: newACType,
        description_text: newACDescriptionText,
        playback_type: newPlaybackType,
        start_time: Number(parseFloat(newACStartTime).toFixed(2)),
        end_time: newClipEndTime,
        duration: Number(newAudioDuration),
        file_path: newClipAudioFilePath,
        file_name: fileName,
        file_mime_type: file_mime_type,
        file_size_bytes: file_size_bytes,
        audio_description: adId,
        user: userId,
        video: videoId,
        created_at: nowUtc(),
        updated_at: nowUtc(),
        transcript: [],
        label: newACTitle,
      });

      const updatedAudioDescription = await MongoAudio_Descriptions_Model.findOneAndUpdate(
        newAudioClip.audio_description,
        {
          $push: {
            audio_clips: {
              $each: [{ _id: newAudioClip._id }],
              $sort: { _id: 1 },
            },
          },
        },
        {
          new: true, // return updated row
        },
      );

      if (!updatedAudioDescription) throw new HttpException(409, "Audio Description couldn't be updated");
      if (!newAudioClip) throw new HttpException(409, "Audio Description couldn't be created");
      return newPlaybackType === newACPlaybackType ? '' : `Note: The playback type of the new clip is modified to ${newPlaybackType}`;
    } else {
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
      return newPlaybackType === newACPlaybackType ? '' : `Note: The playback type of the new clip is modified to ${newPlaybackType}`;
    }
  }

  public async deleteAudioClip(clipId: string, userId: string, videoId: string): Promise<number> {
    if (!clipId) {
      throw new HttpException(400, 'Clip ID is empty');
    }

    const oldAudioFilePathStatus = await getOldAudioFilePath(clipId);
    if (oldAudioFilePathStatus.data === null) {
      throw new HttpException(409, oldAudioFilePathStatus.message);
    }

    const oldAudioPath = oldAudioFilePathStatus.data;

    try {
      let deletedAudioClip: AudioClipDocument | null = null;
      if (CURRENT_DATABASE === 'mongodb') {
        deletedAudioClip = await MongoAudioClipsModel.findById(clipId);
        if (!deletedAudioClip) {
          throw new HttpException(404, 'Audio clip not found');
        }
        console.log('deletedAudioClip (before deletion):', deletedAudioClip);

        // Get the user-specific undo stacks or create a new one
        const userStacks = userUndoStacks[userId] || {};
        console.log('userStacks:', userStacks);

        // Get the undo stack for the current video or create a new one
        const undoStack = userStacks[videoId] || [];
        console.log('undoStack (before pushing):', undoStack);

        // Push the clip to the undo stack
        undoStack.push(deletedAudioClip);
        userStacks[videoId] = undoStack;
        userUndoStacks[userId] = userStacks;
        console.log('undoStack (after pushing):', undoStack);

        deletedAudioClip = await MongoAudioClipsModel.findByIdAndDelete(clipId);
        console.log('deletedAudioClip (after deletion):', deletedAudioClip);

        if (!deletedAudioClip) {
          throw new HttpException(404, 'Audio clip not found after deletion attempt');
        }

        // Delete Audio Clip from Audio Clip Array in Audio Description Object
        await MongoAudio_Descriptions_Model.findByIdAndUpdate(
          deletedAudioClip.audio_description,
          {
            $pull: { audio_clips: deletedAudioClip._id },
          },
          {
            new: true,
          },
        ).catch(err => {
          logger.error(err);
          throw new HttpException(409, "Audio clip couldn't be deleted from Audio Description.");
        });
      }

      if (!deletedAudioClip) {
        throw new HttpException(409, "Audio clip couldn't be deleted.");
      }

      const deleteOldAudioFileStatus = await deleteOldAudioFile(oldAudioPath);
      if (!deleteOldAudioFileStatus) {
        throw new HttpException(409, 'Problem deleting audio clip file. Please try again.');
      }
      return 1; // Indicate successful deletion
    } catch (error) {
      throw new HttpException(error.statusCode || 500, error.message);
    }
  }

  public async undoDeletedAudioClip(userId: string, videoId: string): Promise<IAudioClip | null> {
    // Get the user-specific undo stacks
    const userStacks = userUndoStacks[userId];
    console.log('userStacks:', userUndoStacks);

    if (!userStacks) {
      return null;
    }

    // Get the undo stack for the current video
    const undoStack = userStacks[videoId];
    console.log('undoStack:', undoStack);

    if (!undoStack || undoStack.length === 0) {
      return null;
    }

    try {
      // Pop the most recently deleted clip from the undo stack
      const restoredClip = undoStack.pop();
      console.log('restoredClip:', restoredClip);

      if (CURRENT_DATABASE === 'mongodb' && restoredClip) {
        console.log('INSIDE MONGODB');
        // Save the restored clip to the MongoDB data store
        const clipToSave = restoredClip.toObject();

        // Remove the version key as it's managed by Mongoose
        delete clipToSave.__v;

        const newClip = new MongoAudioClipsModel(clipToSave);
        await newClip.save();
        console.log('newClip (after saving):', newClip);

        // Add the restored clip to the audio_clips array in the corresponding audio description
        await MongoAudio_Descriptions_Model.findByIdAndUpdate(
          restoredClip.audio_description,
          {
            $push: { audio_clips: newClip._id },
          },
          {
            new: true,
          },
        ).catch(err => {
          console.error('Error saving restored clip:', err);
          logger.error(err);
          throw new HttpException(409, "Audio clip couldn't be restored to Audio Description.");
        });

        return newClip;
      }

      return restoredClip || null;
    } catch (error) {
      console.error('Error saving restored clip:', error);
      throw new HttpException(error.statusCode || 500, error.message);
    }
  }
}

export default AudioClipsService;
