import { AddNewAudioClipDto, UpdateAudioClipDescriptionDto, UpdateAudioClipStartTimeDto, UpdateClipAudioPathDto } from '../dtos/audioClips.dto';
import { CURRENT_DATABASE } from '../config';
import { HttpException } from '../exceptions/HttpException';
import { Audio_ClipsAttributes, Audio_Descriptions, PostGres_Audio_Clips, PostGres_Audio_Descriptions, Videos } from '../models/postgres/init-models';
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

class AudioClipsService {
  public async processAllClipsInDB(audioDescriptionAdId: string): Promise<IProcessedClips[]> {
    if (isEmpty(audioDescriptionAdId)) throw new HttpException(400, 'Audio Description ID is empty');

    if (CURRENT_DATABASE == 'mongodb') {
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
          console.log('Yet to update data in DB');
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
    } else {
      const generatedMP3Response = await generateMp3forDescriptionText(userId, youtubeVideoId, clipDescriptionText, clipDescriptionType);
      if (generatedMP3Response.filepath === null) throw new HttpException(409, "Audio Description couldn't be generated");
      const oldAudioFilePathStatus = await getOldAudioFilePath(clipId);
      if (oldAudioFilePathStatus.data === null) throw new HttpException(409, oldAudioFilePathStatus.message);
      const clipDurationStatus = await getAudioDuration(generatedMP3Response.filepath);
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
          clip_audio_path: oldAudioFilePath,
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
    } else {
      const clipAudioFilePath = String(file.path).split('\\').join('/').replace('public', '.');

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
    if (isEmpty(clipId)) throw new HttpException(400, 'Clip ID is empty');

    if (CURRENT_DATABASE == 'mongodb') {
    } else {
      console.log(clipId);

      const oldAudioFilePathStatus = await getOldAudioFilePath(clipId);
      if (oldAudioFilePathStatus.data === null) throw new HttpException(409, oldAudioFilePathStatus.message);
      const old_audio_path = oldAudioFilePathStatus.data;
      // wait until the old file gets deleted
      const deleteOldAudioFileStatus = await deleteOldAudioFile(old_audio_path);
      if (!deleteOldAudioFileStatus) throw new HttpException(409, 'Problem Saving Audio!! Please try again');

      const deletedAudioClip = await PostGres_Audio_Clips.destroy({
        where: {
          clip_id: clipId,
        },
      });
      if (!deletedAudioClip) throw new HttpException(409, "Audio Description couldn't be deleted");
      return deletedAudioClip;
    }
  }
}

export default AudioClipsService;
