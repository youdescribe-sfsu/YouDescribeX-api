import { ClientSession, Types, startSession } from 'mongoose';
import { NewAiDescriptionDto } from '../dtos/audioDescriptions.dto';
import { HttpException } from '../exceptions/HttpException';
import {
  MongoAudioClipsModel,
  MongoAudio_Descriptions_Model,
  MongoDialog_Timestamps_Model,
  MongoUsersModel,
  MongoVideosModel,
} from '../models/mongodb/init-models.mongo';
import { logger } from '../utils/logger';
import { getYouTubeVideoStatus, isEmpty, nowUtc } from '../utils/util';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import { generateMp3forDescriptionText, nudgeStartTimeIfZero, processCurrentClip } from './audioClips.util';
import { isVideoAvailable } from './videos.util';
import { IAudioDescription } from '../models/mongodb/AudioDescriptions.mongo';
import { CreateUserAudioDescriptionDto } from '../dtos/users.dto';

interface IProcessedClips {
  clip_id: any;
  message: string;
  playbackType?: 'extended' | 'inline';
}

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

interface IProcessedClips {
  message: string;
}

export const newAIAudioDescription = async (
  newAIDescription: NewAiDescriptionDto,
): Promise<
  IAudioDescription & {
    _id: Types.ObjectId;
  }
> => {
  const session = await startSession();

  try {
    session.startTransaction();

    const { dialogue_timestamps, audio_clips, aiUserId = 'db72cc2a-b054-4b00-9f85-851b45649be0', youtube_id } = newAIDescription;

    const youtubeVideoData = await getYouTubeVideoStatus(youtube_id);

    if (!youtubeVideoData) {
      throw new HttpException(400, 'No youtubeVideoData provided');
    }

    const aiUser = await MongoUsersModel.findById(aiUserId);
    if (!aiUser) throw new HttpException(404, "AI User doesn't exist");

    const ad = new MongoAudio_Descriptions_Model();

    if (!ad) {
      throw new HttpException(409, "Audio Descriptions couldn't be created");
    }

    await MongoVideosModel.findByIdAndUpdate(
      youtubeVideoData._id,
      {
        $push: {
          audio_descriptions: {
            $each: [{ _id: ad._id }],
          },
        },
      },
      { session },
    ).catch(err => {
      logger.error(err);
      throw new HttpException(409, "Video couldn't be updated.");
    });

    ad.set('video', youtubeVideoData._id);
    ad.set('user', aiUser);

    const new_clip = await MongoAudioClipsModel.insertMany(
      audio_clips.map(clip => {
        return {
          audio_description: ad._id,
          user: aiUser._id,
          video: youtubeVideoData._id,
          description_text: clip.text,
          description_type: clip.type,
          label: `scene ${clip.scene_number}`,
          playback_type: 'extended',
          start_time: clip.start_time,
        };
      }),
      { session },
    );

    if (!new_clip) {
      throw new HttpException(409, "Audio Clips couldn't be created");
    }

    ad.set(
      'audio_clips',
      new_clip.map(clip => clip._id),
    );

    const new_timestamp = await MongoDialog_Timestamps_Model.create(
      dialogue_timestamps.map(timestamp => {
        return {
          video: youtubeVideoData,
          dialog_sequence_num: timestamp.sequence_num,
          dialog_start_time: timestamp.start_time,
          dialog_end_time: timestamp.end_time,
          dialog_duration: timestamp.duration,
        };
      }),
      { session },
    );

    if (!new_timestamp) {
      throw new HttpException(409, "Dialog Timestamps couldn't be created");
    }

    ad.save();
    await processAllClipsInDBSession(ad._id, session);
    await session.commitTransaction();
    session.endSession();

    return ad;
  } catch (error) {
    console.error(error);
    await session.abortTransaction();
    session.endSession();
    throw new HttpException(500, 'Internal Server Error');
  }
};

export const processAllClipsInDBSession = async (audioDescriptionAdId: string, session: ClientSession): Promise<IProcessedClips[]> => {
  if (isEmpty(audioDescriptionAdId)) throw new HttpException(400, 'Audio Description ID is empty');

  try {
    const audioDescriptions = await getAudioDescriptions(audioDescriptionAdId, session);
    const populatedAudioClip = await populateAudioClipData(audioDescriptions, session);
    const nudgeStatus = await nudgeStartTimeIfZero(populatedAudioClip, session);
    if (nudgeStatus.data === null) throw new HttpException(409, nudgeStatus.message);
    const descriptionTexts = getDescriptionTexts(populatedAudioClip);
    const statusData = await generateTextToSpeechOutput(descriptionTexts, audioDescriptionAdId);
    const updateStatusOfAllClips = await updateAllClipsStatus(statusData, session);

    return updateStatusOfAllClips;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getAudioDescriptions = async (audioDescriptionAdId: string, session: ClientSession) => {
  return await MongoAudioClipsModel.find({ audio_description: audioDescriptionAdId }).session(session);
};

const populateAudioClipData = async (audioDescriptions: IAudioClip[], session: ClientSession) => {
  const populatedAudioClip: PopulatedAudioDescription[] = [];

  for (let i = 0; i < audioDescriptions.length; i++) {
    const audioDescription: IAudioClip = audioDescriptions[i];
    const populatedAudioDescription = await MongoAudio_Descriptions_Model.findById(audioDescription.audio_description).session(session);
    const populatedVideo = await MongoVideosModel.findById(populatedAudioDescription.video).session(session);

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

  return populatedAudioClip;
};

const getDescriptionTexts = (populatedAudioClip: PopulatedAudioDescription[]) => {
  return populatedAudioClip.map(clip => {
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
};

const generateTextToSpeechOutput = async (descriptionTexts: any[], audioDescriptionAdId: string) => {
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

  return statusData;
};

const updateAllClipsStatus = async (statusData: any[], session: ClientSession) => {
  const updateStatusOfAllClips: IProcessedClips[] = [];
  await Promise.all(
    statusData.map(async data => {
      logger.info('Yet to update data in DB');
      // to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table
      const updateStatus = await processCurrentClip(data, session);
      // get the status message and push it to an array
      updateStatusOfAllClips.push(updateStatus);
    }),
  );

  if (!updateStatusOfAllClips) throw new HttpException(409, "Audio Descriptions couldn't be updated");

  return updateStatusOfAllClips;
};

export const generateAudioDescGpuWithSession = async (newUserAudioDescription: CreateUserAudioDescriptionDto, user_id: string, session: ClientSession) => {
  const { youtubeVideoId, aiUserId } = newUserAudioDescription;

  if (!youtubeVideoId) throw new HttpException(400, 'youtubeVideoId is empty');
  if (!aiUserId) throw new HttpException(400, 'aiUserId is empty');

  const videoIdStatus = await getYouTubeVideoStatus(youtubeVideoId);
  const userIdObject = await MongoUsersModel.findById(user_id);
  const aiUserObjectId = aiUserId;

  const aiUser = await MongoUsersModel.findById(aiUserObjectId);

  const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne(
    {
      video: videoIdStatus._id,
      user: userIdObject._id,
    },
    null,
    { session },
  );

  if (checkIfAudioDescriptionExists) {
    return {
      audioDescriptionId: checkIfAudioDescriptionExists._id,
    };
  }

  const aiAudioDescriptions = await MongoVideosModel.aggregate([
    {
      $match: {
        youtube_id: youtubeVideoId,
      },
    },
    {
      $unwind: {
        path: '$audio_descriptions',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: 'audio_descriptions',
        localField: 'audio_descriptions',
        foreignField: '_id',
        as: 'video_ad',
      },
    },
    {
      $unwind: {
        path: '$video_ad',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'video_ad.user',
        foreignField: '_id',
        as: 'video_ad_user',
      },
    },
    {
      $unwind: {
        path: '$video_ad_user',
      },
    },
    {
      $match: {
        'video_ad_user.user_type': 'AI',
        'video_ad_user._id': aiUser._id,
      },
    },
  ]);

  const createNewAudioDescription = new MongoAudio_Descriptions_Model(
    {
      admin_review: false,
      audio_clips: [],
      created_at: nowUtc(),
      language: 'en',
      legacy_notes: '',
      updated_at: nowUtc(),
      video: videoIdStatus._id,
      user: userIdObject._id,
    },
    { session },
  );

  const audioClipArray = [];

  for (let i = 0; i < aiAudioDescriptions[0].video_ad.audio_clips.length; i++) {
    const clipId = aiAudioDescriptions[0].video_ad.audio_clips[i];
    const clip = await MongoAudioClipsModel.findById(clipId);
    const createNewAudioClip = new MongoAudioClipsModel(
      {
        audio_description: createNewAudioDescription._id,
        created_at: nowUtc(),
        description_type: clip.description_type,
        description_text: clip.description_text,
        duration: clip.duration,
        end_time: clip.end_time,
        file_mime_type: clip.file_mime_type,
        file_name: clip.file_name,
        file_path: clip.file_path,
        file_size_bytes: clip.file_size_bytes,
        label: clip.label,
        playback_type: clip.playback_type,
        start_time: clip.start_time,
        transcript: [],
        updated_at: nowUtc(),
        user: userIdObject._id,
        video: videoIdStatus._id,
        is_recorded: false,
      },
      { session },
    );

    if (!createNewAudioClip) {
      throw new HttpException(409, "Audio Clip couldn't be created");
    }
    audioClipArray.push(createNewAudioClip);
  }

  const createNewAudioClips = await MongoAudioClipsModel.insertMany(audioClipArray, { session });

  if (!createNewAudioClips) {
    throw new HttpException(409, "Audio Clips couldn't be created");
  }

  for (const clip of createNewAudioClips) {
    createNewAudioDescription.audio_clips.push(clip);
    await clip.save({ session });
  }

  await createNewAudioDescription.save({ session });

  await MongoVideosModel.findByIdAndUpdate(
    videoIdStatus._id,
    {
      $push: {
        audio_descriptions: {
          $each: [{ _id: createNewAudioDescription._id }],
        },
      },
    },
    { session },
  ).catch(err => {
    logger.error(err);
    throw new HttpException(409, "Video couldn't be updated.");
  });

  return {
    audioDescriptionId: createNewAudioDescription._id,
    fromAI: true,
  };
};
