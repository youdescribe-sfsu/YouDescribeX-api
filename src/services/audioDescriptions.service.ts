import { ObjectId } from 'mongodb';
import { AUDIO_DIRECTORY, CURRENT_DATABASE } from '../config';
import { NewAiDescriptionDto } from '../dtos/audioDescriptions.dto';
import { HttpException } from '../exceptions/HttpException';
import { IAudioDescription } from '../models/mongodb/AudioDescriptions.mongo';
import {
  MongoAudioClipsModel,
  MongoAudio_Descriptions_Model,
  MongoDialog_Timestamps_Model,
  MongoNotesModel,
  MongoUsersModel,
  MongoVideosModel,
  MongoAICaptionRequestModel,
  MongoWishListModel,
} from '../models/mongodb/init-models.mongo';
import {
  Audio_DescriptionsAttributes,
  PostGres_Audio_Clips,
  PostGres_Audio_Descriptions,
  PostGres_Dialog_Timestamps,
  PostGres_Users,
  PostGres_Videos,
} from '../models/postgres/init-models';
import { logger } from '../utils/logger';
import { getYouTubeVideoStatus, isEmpty, nowUtc } from '../utils/util';
import { isVideoAvailable } from '../utils/videos.util';
import cacheService from '../utils/cacheService';
import GpuUtilsService from './gpu_utils.service';

const fs = require('fs');

class AudioDescriptionsService {
  public async getUserAudioDescriptionData(
    videoId: string,
    userId: string,
    audio_description_id: string,
    preview = false,
  ): Promise<{
    Audio_Clips: any[];
    createdAt: any;
    ad_id: any;
    is_published: boolean;
    VideoVideoId: string;
    UserUserId: any;
    Notes: any;
    updatedAt: any;
  }> {
    if (isEmpty(videoId)) throw new HttpException(400, 'Video ID is empty');
    if (!userId) throw new HttpException(400, 'User ID is empty');
    if (isEmpty(audio_description_id)) throw new HttpException(400, 'Audio Description ID is empty');
    if (CURRENT_DATABASE == 'mongodb') {
      const audioDescriptions = await MongoAudio_Descriptions_Model.findOne({
        _id: audio_description_id,
      });

      if (!audioDescriptions) throw new HttpException(409, "Audio Description for this YouTube Video doesn't exist");

      // Only enforce published status check if not in preview mode
      if (!preview && audioDescriptions.status !== 'published') {
        throw new HttpException(409, 'Audio Description for this YouTube Video is not published');
      }
      const audio_clips = audioDescriptions.audio_clips;
      const audioClipArr = await MongoAudioClipsModel.find({
        audio_description: audioDescriptions._id,
      })
        .sort({
          start_time: 'asc',
          end_time: 'asc',
        })
        .exec();
      if (audio_clips.length !== audioClipArr.length) {
        logger.error(
          `Number of Audio Clips in Audio Description Collection (${audio_clips.length})does not match actual number of AUdio Clips (${audioClipArr.length}).`,
        );
        throw new HttpException(409, 'Something went wrong getting Audio Clips for Audio Description');
      }
      const transformedAudioClipArr = [];
      for (let i = 0; i < audioClipArr.length; i++) {
        const audioClip = audioClipArr[i];
        const transformedAudioClip = {
          clip_id: audioClip._id,
          clip_title: audioClip.label,
          description_type: audioClip.description_type,
          description_text: audioClip.description_text || audioClip.transcript.map(obj => obj.sentence).join(' '),
          playback_type: audioClip.playback_type,
          clip_start_time: audioClip.start_time,
          clip_end_time: audioClip.end_time,
          clip_duration: audioClip.duration,
          clip_audio_path: audioClip.file_name ? audioClip.file_path + '/' + audioClip.file_name : audioClip.file_path,
          is_recorded: audioClip.is_recorded,
          createdAt: audioClip.created_at,
          updatedAt: audioClip.updated_at,
          AudioDescriptionAdId: audioClip,
        };
        transformedAudioClipArr.push(transformedAudioClip);
      }

      const notes = await MongoNotesModel.find({ audio_description: audioDescriptions._id });

      const transformedNotes = notes.map(note => {
        return {
          notes_id: note._id,
          notes_text: note.notes_text,
          AudioDescriptionAdId: note.audio_description,
        };
      });

      const newObj = {
        Audio_Clips: transformedAudioClipArr,
        Notes: transformedNotes,
        UserUserId: audioDescriptions.user,
        VideoVideoId: videoId,
        ad_id: audioDescriptions._id,
        createdAt: audioDescriptions.created_at,
        updatedAt: audioDescriptions.updated_at,
        is_published: audioDescriptions.status === 'published',
        is_collaborative_version: audioDescriptions.depth && audioDescriptions.depth > 1,
      };

      return newObj;
    }
    throw new HttpException(500, `Database provider '${CURRENT_DATABASE}' is not supported or implemented.`);
  }

  public async newAiDescription(newAIDescription: NewAiDescriptionDto): Promise<IAudioDescription | Audio_DescriptionsAttributes> {
    const { dialogue_timestamps, audio_clips, aiUserId = 'db72cc2a-b054-4b00-9f85-851b45649be0', youtube_id, video_name, video_length } = newAIDescription;
    // if (isEmpty(dialogue_timestamps)) throw new HttpException(400, 'dialog is empty');
    if (isEmpty(audio_clips)) {
      if (youtube_id) {
        await MongoAICaptionRequestModel.updateOne({ youtube_id, status: 'processing' }, { $set: { status: 'completed' } });
        const gpuUtils = new GpuUtilsService();
        await gpuUtils.notifyAiDescriptionFailure(youtube_id, 'The AI pipeline was unable to generate any audio descriptions for this video.');
      }
      throw new HttpException(400, 'audio clips is empty');
    }
    if (isEmpty(youtube_id)) throw new HttpException(400, 'youtube video id is empty');
    if (isEmpty(video_name)) throw new HttpException(400, 'video name is empty');
    if (isEmpty(video_length)) throw new HttpException(400, 'video length is empty');

    const youtubeVideoData = await isVideoAvailable(youtube_id);

    if (!youtubeVideoData) {
      throw new HttpException(400, 'No youtubeVideoData provided');
    }

    if (CURRENT_DATABASE == 'mongodb') {
      // console.log('aiUserId', aiUserId);
      const aiUserObjectId = new ObjectId(aiUserId);
      const aiUser = await MongoUsersModel.findById(aiUserObjectId);
      if (!aiUser) throw new HttpException(404, "ai User doesn't exist");
      let vid: any = await getYouTubeVideoStatus(youtube_id);
      const ad = new MongoAudio_Descriptions_Model();
      if (!ad) throw new HttpException(409, "Audio Descriptions couldn't be created");
      if (vid) {
        ad.set('video', vid._id);
        // Add Audio Description to Video Audio Description Array for consistency with old MongodB and YD Classic logic
        await MongoVideosModel.findByIdAndUpdate(vid._id, {
          $push: {
            audio_descriptions: {
              $each: [{ _id: ad._id }],
            },
          },
        }).catch(err => {
          logger.error(err);
          throw new HttpException(409, "Video couldn't be updated.");
        });
      } else {
        const newVid = new MongoVideosModel({
          audio_descriptions: [],
          category: '',
          category_id: 0,
          youtube_id: youtube_id,
          title: video_name,
          duration: video_length,
          description: '',
          tags: [],
          custom_tags: [],
          views: 0,
          youtube_status: 'ready',
          updated_at: nowUtc(),
        });
        const newSavedVideo = await newVid.save();
        if (!newSavedVideo) throw new HttpException(409, "Video couldn't be created");
        await MongoVideosModel.findByIdAndUpdate(newVid._id, {
          $push: {
            audio_descriptions: {
              $each: [{ _id: ad._id }],
            },
          },
        }).catch(err => {
          logger.error(err);
          throw new HttpException(409, "Video couldn't be updated.");
        });
        ad.set('video', newSavedVideo._id);
        vid = newSavedVideo;
      }
      ad.set('user', aiUser);
      const new_clip = await MongoAudioClipsModel.insertMany(
        audio_clips.map(clip => {
          return {
            audio_description: ad._id,
            user: aiUser._id,
            video: vid._id,
            description_text: clip.text,
            description_type: clip.type,
            label: `scene ${clip.scene_number}`,
            playback_type: 'extended',
            start_time: clip.start_time,
          };
        }),
      );
      if (!new_clip) throw new HttpException(409, "Audio Clips couldn't be created");
      ad.set(
        'audio_clips',
        new_clip.map(clip => clip._id),
      );

      const new_timestamp = await MongoDialog_Timestamps_Model.create(
        dialogue_timestamps.map(timestamp => {
          return {
            video: vid,
            dialog_sequence_num: timestamp.sequence_num,
            dialog_start_time: timestamp.start_time,
            dialog_end_time: timestamp.end_time,
            dialog_duration: timestamp.duration,
          };
        }),
      );
      if (!new_timestamp) throw new HttpException(409, "Dialog Timestamps couldn't be created");
      // console.log('new_timestamp', ad);
      await ad.save();
      await MongoAICaptionRequestModel.findOneAndUpdate({ youtube_id: youtube_id }, { status: 'completed' });
      try {
        const gpuUtils = new GpuUtilsService();
        const ydx_app_host = process.env.FRONTEND_URL || 'http://localhost:3000';

        await gpuUtils.notifyAiDescriptions(youtube_id, ad._id.toString(), ydx_app_host, []);
        logger.info(`Notification trigger for ${youtube_id} initiated successfully.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Notification failed: ${message}`);
      }
      // --- END NOTIFICATION EMAIL BLOCK ---
      return ad; // <--- MOVE THIS HERE (At the very end of the if block)
    } else {
      const aiUser = await PostGres_Users.findOne({
        where: {
          user_id: aiUserId, // AI User ID
        },
      });
      if (!aiUser) throw new HttpException(404, "ai User doesn't exist");

      const vid = await PostGres_Videos.findOne({
        where: { youtube_video_id: youtube_id },
      });

      const ad = await PostGres_Audio_Descriptions.create({
        is_published: false,
      } as any); // The 'as any' tells TS: "I know what I'm doing, don't check the properties."
      if (!ad) throw new HttpException(409, "Audio Descriptions couldn't be created");

      if (vid) {
        await ad.setVideoVideo(vid);
      } else {
        throw new Error("Postgres logic is deprecated. Update CURRENT_DATABASE to 'mongodb'.");
      }

      await ad.setUserUser(aiUser);

      const new_clip = await PostGres_Audio_Clips.bulkCreate(
        audio_clips.map(clip => {
          return {
            clip_title: 'scene ' + clip.scene_number,
            description_text: clip.text,
            playback_type: 'extended',
            description_type: clip.type,
            clip_start_time: clip.start_time,
          };
        }) as any[],
      );
      if (!new_clip) throw new HttpException(409, "Audio Clips couldn't be created");

      const new_timestamp = await PostGres_Dialog_Timestamps.bulkCreate(
        dialogue_timestamps.map(timestamp => {
          return {
            dialog_sequence_num: timestamp.sequence_num,
            dialog_start_time: timestamp.start_time,
            dialog_end_time: timestamp.end_time,
            dialog_duration: timestamp.duration,
          };
        }) as any[],
      );
      if (!new_timestamp) throw new HttpException(409, "Dialog Timestamps couldn't be created");

      return ad;
    }
  }

  public async deleteUserADAudios(youtube_video_id: string, adId: string) {
    if (isEmpty(youtube_video_id)) throw new HttpException(400, 'Youtube Video ID is empty');
    if (isEmpty(adId)) throw new HttpException(400, 'Audio Description ID is empty');

    const pathToFolder = `${AUDIO_DIRECTORY}/audio/${youtube_video_id}/${adId}`;

    // 1. Use Sync version or await fs.promises.readdir to ensure 'files' isn't undefined
    if (!fs.existsSync(pathToFolder)) {
      throw new HttpException(404, 'Folder does not exist');
    }

    const files: string[] = fs.readdirSync(pathToFolder);

    const dataToSend: any[] = [];

    // 2. 'file' is now correctly inferred or explicitly typed as string
    files.forEach((file: string, i: number) => {
      fs.unlinkSync(pathToFolder + '/' + file);
      dataToSend.push({
        SerialNumber: i + 1,
        file: file,
        status: 'File Deleted Successfully.',
      });
    });

    // 3. Fix the comparison (use .length instead of assignment)
    if (dataToSend.length === 0) {
      throw new HttpException(409, 'No files were found to delete.');
    }

    logger.info('User AD deleted successfully');
    return dataToSend;
  }

  public publishAudioDescription = async (
    audioDescriptionId: string,
    youtube_id: string,
    user_id: string,
    enrolled_in_collaborative_editing: boolean,
  ): Promise<string> => {
    logger.info(`[COLLAB] Publishing audio description ${audioDescriptionId} for video ${youtube_id} by user ${user_id}`);
    logger.info(`[COLLAB] Collaborative editing enabled: ${enrolled_in_collaborative_editing}`);
    try {
      const videoIdStatus = await getYouTubeVideoStatus(youtube_id);

      if (!videoIdStatus) {
        throw new HttpException(400, 'No videoIdStatus provided');
      }

      const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne({
        video: videoIdStatus._id,
        _id: audioDescriptionId,
      });

      if (!checkIfAudioDescriptionExists) {
        throw new HttpException(404, 'No audioDescriptionId Found');
      }

      const updateFields: any = {
        status: 'published',
        updated_at: nowUtc(),
        collaborative_editing: enrolled_in_collaborative_editing,
      };

      // Only update user if this is NOT a collaborative edit
      if (!checkIfAudioDescriptionExists.prev_audio_description) {
        updateFields.user = user_id;
      }

      const audioDescription = await MongoAudio_Descriptions_Model.findByIdAndUpdate(
        audioDescriptionId,
        updateFields,
        { new: true }, // Return the updated document
      );

      if (!audioDescription) {
        throw new HttpException(404, 'Failed to update: Audio Description not found');
      }

      // Check if this audio description is already in the video's array to prevent duplicates
      const videoWithAD = await MongoVideosModel.findOne({
        _id: videoIdStatus._id,
        audio_descriptions: audioDescriptionId,
      });

      // Only add the audio description if it's not already in the array
      if (!videoWithAD) {
        await MongoVideosModel.findByIdAndUpdate(videoIdStatus._id, {
          $addToSet: { audio_descriptions: audioDescriptionId }, // Use $addToSet instead of $push
        });
      }

      await MongoWishListModel.updateOne({ youtube_id: youtube_id, status: 'queued' }, { $set: { status: 'fulfilled' } });

      logger.info(`[COLLAB] Audio description ${audioDescriptionId} published successfully`);

      await cacheService.invalidateByPrefix('home_videos');
      logger.info(`[COLLAB] Home page cache invalidated after publishing audio description ${audioDescriptionId}`);

      return audioDescription._id.toString();
    } catch (error: any) {
      // Change 'error' to 'error: any'
      logger.error(`[COLLAB] Error publishing audio description: ${error.message}`);
      logger.error(`[COLLAB] Error stack: ${error.stack}`);
      throw error;
    }
  };

  public unpublishAudioDescription = async (audioDescriptionId: string, youtube_id: string, user_id: string): Promise<string> => {
    try {
      const videoIdStatus = await getYouTubeVideoStatus(youtube_id);

      if (!videoIdStatus) {
        throw new HttpException(400, 'No videoIdStatus provided');
      }

      // 1. Update the Description status to 'draft'
      const audioDescription = await MongoAudio_Descriptions_Model.findByIdAndUpdate(
        audioDescriptionId,
        {
          status: 'draft',
          updated_at: nowUtc(),
          user: user_id,
        },
        { new: true }, // Return the updated doc
      );

      // FIX: TypeScript Null Guard
      if (!audioDescription) {
        throw new HttpException(404, 'Audio Description not found');
      }

      // 2. Ensure the ID is in the video list (without creating duplicates)
      // We use $addToSet instead of $push
      await MongoVideosModel.findByIdAndUpdate(videoIdStatus._id, {
        $addToSet: { audio_descriptions: audioDescriptionId },
      });

      return audioDescription._id.toString();
    } catch (error: any) {
      // FIX: Type 'any' for logging
      logger.error(`[UNPUBLISH] Error: ${error.message}`);
      throw error;
    }
  };

  public getAudioDescription = async (
    audioDescriptionId: string,
    preview = false,
  ): Promise<{
    Audio_Clips: any[];
    createdAt: any;
    ad_id: any;
    editing_allowed: any;
    is_published: boolean;
    VideoVideoId: any;
    UserUserId: any;
    youtube_id: any;
    Notes: any;
    updatedAt: any;
  }> => {
    const audioDescriptions = await MongoAudio_Descriptions_Model.findOne({
      _id: audioDescriptionId,
    });

    if (!audioDescriptions) throw new HttpException(409, "Audio Description for this YouTube Video doesn't exist");

    if (!preview && audioDescriptions.status !== 'published') throw new HttpException(409, 'Audio Description for this YouTube Video is not published');

    const videoId = audioDescriptions.video;
    const youtubeVideoData = await MongoVideosModel.findById({
      _id: videoId,
    });

    if (!youtubeVideoData) {
      throw new HttpException(400, 'No youtubeVideoData Found');
    }

    const audio_clips = audioDescriptions.audio_clips;
    const audioClipArr = await MongoAudioClipsModel.find({
      audio_description: audioDescriptions._id,
    })
      .sort({
        start_time: 'asc',
        end_time: 'asc',
      })
      .exec();

    if (audio_clips.length !== audioClipArr.length) {
      logger.error(
        `Number of Audio Clips in Audio Description Collection (${audio_clips.length})does not match actual number of AUdio Clips (${audioClipArr.length}).`,
      );
      throw new HttpException(409, 'Something went wrong getting Audio Clips for Audio Description');
    }
    const transformedAudioClipArr = [];
    for (let i = 0; i < audioClipArr.length; i++) {
      const audioClip = audioClipArr[i];
      const transformedAudioClip = {
        clip_id: audioClip._id,
        clip_title: audioClip.label,
        description_type: audioClip.description_type,
        description_text: audioClip.description_text || audioClip.transcript.map(obj => obj.sentence).join(' '),
        playback_type: audioClip.playback_type,
        clip_start_time: audioClip.start_time,
        clip_end_time: audioClip.end_time,
        clip_duration: audioClip.duration,
        clip_audio_path: audioClip.file_name ? audioClip.file_path + '/' + audioClip.file_name : audioClip.file_path,
        is_recorded: audioClip.is_recorded,
        createdAt: audioClip.created_at,
        updatedAt: audioClip.updated_at,
        AudioDescriptionAdId: audioClip,
      };
      transformedAudioClipArr.push(transformedAudioClip);
    }

    const notes = await MongoNotesModel.find({ audio_description: audioDescriptions._id });

    const transformedNotes = notes.map(note => {
      return {
        notes_id: note._id,
        notes_text: note.notes_text,
        AudioDescriptionAdId: note.audio_description,
      };
    });

    const newObj = {
      Audio_Clips: transformedAudioClipArr,
      Notes: transformedNotes,
      UserUserId: audioDescriptions.user,
      VideoVideoId: videoId,
      ad_id: audioDescriptions._id,
      createdAt: audioDescriptions.created_at,
      updatedAt: audioDescriptions.updated_at,
      is_published: audioDescriptions.status === 'published',
      youtube_id: youtubeVideoData.youtube_id,
      editing_allowed: audioDescriptions.collaborative_editing,
    };

    return newObj;
  };

  public async getMyDescriptions(user_id: string, pageNumber: string, paginate: boolean) {
    if (!user_id) {
      throw new HttpException(400, 'No data provided');
    }

    try {
      const cacheKey = `my_descriptions_${user_id}_${pageNumber}_${paginate}`;
      const cachedResult = await cacheService.get(cacheKey);
      if (cachedResult) {
        logger.info(`Cache hit for my descriptions: ${cacheKey}`);
        return cachedResult;
      }

      logger.info(`Cache miss for my descriptions: ${cacheKey}`);
      const page = parseInt(pageNumber, 10) || 1;
      const videosPerPage = paginate ? 4 : 20; // Set videos per page to 4 if paginate is true, otherwise 20
      const skipCount = (page - 1) * videosPerPage;

      const pipeline: Array<any> = [
        { $match: { user: new ObjectId(user_id), status: 'published' } },
        {
          $lookup: {
            from: 'videos',
            localField: 'video',
            foreignField: '_id',
            as: 'videoData',
          },
        },
        { $unwind: '$videoData' },
        {
          $project: {
            video_id: '$videoData._id',
            youtube_video_id: '$videoData.youtube_id',
            video_name: '$videoData.title',
            video_length: '$videoData.duration',
            createdAt: '$created_at',
            updatedAt: '$updated_at',
            audio_description_id: '$_id',
            status: 1,
            overall_rating_votes_average: 1,
            overall_rating_votes_counter: 1,
            overall_rating_votes_sum: 1,
          },
        },
        { $sort: { updatedAt: -1 } },
        {
          $facet: {
            totalCount: [{ $count: 'count' }],
            paginatedResults: [{ $skip: skipCount }, { $limit: videosPerPage }],
          },
        },
        {
          $project: {
            total: { $arrayElemAt: ['$totalCount.count', 0] },
            videos: '$paginatedResults',
          },
        },
      ];

      const result = await MongoAudio_Descriptions_Model.aggregate(pipeline).exec();
      const response = {
        total: result[0]?.total || 0,
        videos: result[0]?.videos || [],
      };

      await cacheService.set(cacheKey, response, 5 * 60 * 1000);

      return response;
    } catch (error) {
      logger.error('Error occurred:', error);
      throw error;
    }
  }

  public async getMyDraftDescriptions(user_id: string, pageNumber: string) {
    if (!user_id) {
      throw new HttpException(400, 'No data provided');
    }

    try {
      const page = parseInt(pageNumber, 10) || 1;
      const videosPerPage = 20;
      const skipCount = (page - 1) * videosPerPage;

      const pipeline: Array<any> = [
        { $match: { user: new ObjectId(user_id), status: 'draft' } },
        {
          $lookup: {
            from: 'videos',
            localField: 'video',
            foreignField: '_id',
            as: 'videoData',
          },
        },
        { $unwind: '$videoData' },
        {
          $project: {
            video_id: '$videoData._id',
            youtube_video_id: '$videoData.youtube_id',
            video_name: '$videoData.title',
            video_length: '$videoData.duration',
            createdAt: '$created_at',
            updatedAt: '$updated_at',
            audio_description_id: '$_id',
            status: 1,
            overall_rating_votes_average: 1,
            overall_rating_votes_counter: 1,
            overall_rating_votes_sum: 1,
          },
        },
        { $sort: { updatedAt: -1 } },
        {
          $facet: {
            totalCount: [{ $count: 'count' }],
            paginatedResults: [{ $skip: skipCount }, { $limit: videosPerPage }],
          },
        },
        {
          $project: {
            total: { $arrayElemAt: ['$totalCount.count', 0] },
            videos: '$paginatedResults',
          },
        },
      ];

      const result = await MongoAudio_Descriptions_Model.aggregate(pipeline).exec();

      return {
        total: result[0]?.total || 0,
        videos: result[0]?.videos || [],
      };
    } catch (error) {
      logger.error('Error occurred:', error);
      throw error;
    }
  }

  public async getAllAIDescriptions(user_id: string, pageNumber: string) {
    if (!user_id) {
      throw new HttpException(400, 'No data provided');
    }

    try {
      const page = parseInt(pageNumber, 10) || 1;
      const perPage = 5;
      const skipCount = (page - 1) * perPage;
      const pipeline: any[] = [
        { $match: { status: 'completed' } },
        {
          $lookup: {
            from: 'videos',
            localField: 'youtube_id',
            foreignField: 'youtube_id',
            as: 'video',
          },
        },
        { $unwind: '$video' },
        {
          $group: {
            _id: '$_id',
            status: { $first: '$status' },
            video: { $first: '$video' },
            requestCreatedAt: { $first: '$created_at' },
            requestCompletedAt: { $first: '$completed_at' },
          },
        },
        {
          $project: {
            _id: 1,
            status: 1,
            video_id: '$video._id',
            youtube_id: '$video.youtube_id',
            video_name: '$video.title',
            video_length: '$video.duration',
            createdAt: '$requestCompletedAt',
            updatedAt: '$video.updated_at',
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            videos: [{ $skip: skipCount }, { $limit: perPage }],
            totalCount: [{ $count: 'count' }],
          },
        },
        {
          $project: {
            videos: '$videos',
            total: { $arrayElemAt: ['$totalCount.count', 0] },
          },
        },
      ];
      const result = await MongoAICaptionRequestModel.aggregate(pipeline).exec();
      return {
        result: result[0]?.videos || [],
        totalVideos: result[0]?.total || 0,
      };
    } catch (error) {
      logger.error('Error occurred:', error);
      throw error;
    }
  }
}

export default AudioDescriptionsService;
