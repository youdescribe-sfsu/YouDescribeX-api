import { CreateUserAudioDescriptionDto, CreateUserDto, NewUserDto } from '../dtos/users.dto';
import { HttpException } from '../exceptions/HttpException';
import { getYouTubeVideoStatus, isEmpty, nowUtc } from '../utils/util';
import { CURRENT_DATABASE, CURRENT_YDX_HOST, GPU_URL, AI_USER_ID } from '../config';
import { PostGres_Users, UsersAttributes } from '../models/postgres/init-models';
import {
  MongoAICaptionRequestModel,
  MongoAudioClipsModel,
  MongoAudio_Descriptions_Model,
  MongoHistoryModel,
  MongoUsersModel,
  MongoVideosModel,
} from '../models/mongodb/init-models.mongo';
import { IUser } from '../models/mongodb/User.mongo';
import { logger } from '../utils/logger';
import { getVideoDataByYoutubeId, isVideoAvailable } from './videos.util';
import moment from 'moment';
import axios from 'axios';
import mongoose from 'mongoose';
import AudioClipsService from './audioClips.service';
import { ObjectId } from 'mongodb';
import sendEmail from '../utils/emailService';
import { IAudioDescription } from '../models/mongodb/AudioDescriptions.mongo';

class UserService {
  public audioClipsService = new AudioClipsService();
  public async findAllUser(): Promise<IUser[] | UsersAttributes[]> {
    if (CURRENT_DATABASE == 'mongodb') {
      const users = await MongoUsersModel.find();
      return users;
    } else {
      const users = await PostGres_Users.findAll();
      return users;
    }
  }

  public async findUserByEmail(userEmail: string): Promise<IUser | UsersAttributes> {
    if (isEmpty(userEmail)) throw new HttpException(400, 'UserId is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findUserByEmail = await MongoUsersModel.findOne({
        email: userEmail,
      });
      if (!findUserByEmail) throw new HttpException(409, "User doesn't exist");
      return findUserByEmail;
    } else {
      const findUserByEmail = await PostGres_Users.findOne({
        where: { user_email: userEmail },
      });
      if (!findUserByEmail) throw new HttpException(409, "User doesn't exist");
      return findUserByEmail;
    }
  }

  public async createUser(userData: CreateUserDto): Promise<IUser | UsersAttributes> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findUser = await MongoUsersModel.findOne({
        email: userData.email,
      });
      if (findUser) throw new HttpException(409, `This email ${userData.email} already exists`);
      const createUserData = await MongoUsersModel.create({
        user_type: userData.isAI ? 'AI' : 'Volunteer',
        admin_level: 0,
        email: userData.email,
        name: userData.name,
        // TODO: add the rest of the fields
      });
      return createUserData;
    } else {
      const findUser = await PostGres_Users.findOne({
        where: { user_email: userData.email },
      });
      if (findUser) throw new HttpException(409, `This email ${userData.email} already exists`);
      const createUserData = await PostGres_Users.create({
        is_ai: false,
        name: userData.name,
        user_email: userData.email,
      });
      return createUserData;
    }
  }

  public async deleteUser(userEmail: string): Promise<IUser | UsersAttributes> {
    if (isEmpty(userEmail)) throw new HttpException(400, 'UserEmail is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const deleteUserByEmail = await MongoUsersModel.findOneAndDelete({
        email: userEmail,
      });
      if (!deleteUserByEmail) throw new HttpException(409, "User doesn't exist");
      return deleteUserByEmail;
    } else {
      const deleteUserByEmail = await PostGres_Users.findOne({
        where: { user_email: userEmail },
      });
      if (!deleteUserByEmail) throw new HttpException(409, "User doesn't exist");
      await PostGres_Users.destroy({ where: { user_email: userEmail } });
      return deleteUserByEmail;
    }
  }

  public async createNewUserAudioDescription(newUserAudioDescription: CreateUserAudioDescriptionDto, expressUser: Express.User) {
    const { youtubeVideoId, aiUserId } = newUserAudioDescription;
    if (isEmpty(expressUser)) throw new HttpException(403, 'User not logged in');
    if (isEmpty(youtubeVideoId)) throw new HttpException(400, 'youtubeVideoId is empty');

    const youtubeVideoData = await isVideoAvailable(youtubeVideoId);

    if (!youtubeVideoData) {
      throw new HttpException(400, 'No youtubeVideoData provided');
    }
    let user: IUser | null = null;

    const aiUserObjectId = new ObjectId(aiUserId);

    const aiUser = await MongoUsersModel.findById(aiUserObjectId);
    if (aiUser) user = aiUser;
    else user = expressUser as IUser;

    if (CURRENT_DATABASE == 'mongodb') {
      const videoIdStatus = await getYouTubeVideoStatus(youtubeVideoId);
      if (!videoIdStatus) {
        // No video found which means no audio descriptions have been made for the specified youtube video
        try {
          const getVideoDataResponse = await getVideoDataByYoutubeId(youtubeVideoId);

          const newVideo = new MongoVideosModel({
            audio_descriptions: [],
            category: getVideoDataResponse.category,
            category_id: getVideoDataResponse.category_id,
            youtube_id: youtubeVideoId,
            title: getVideoDataResponse.title,
            duration: getVideoDataResponse.duration,
            description: getVideoDataResponse.description,
            tags: [],
            custom_tags: [],
            views: 0,
            youtube_status: 'ready',
            updated_at: nowUtc(),
          });
          const newSavedVideo = await newVideo.save();
          if (!newSavedVideo) throw new HttpException(409, "Video couldn't be created");

          const createNewAudioDescription = new MongoAudio_Descriptions_Model({
            admin_review: false,
            audio_clips: [],
            created_at: nowUtc(),
            language: 'en',
            legacy_notes: '',
            updated_at: nowUtc(),
            video: newSavedVideo._id,
            user: user._id,
          });
          createNewAudioDescription.save();
          if (!createNewAudioDescription) throw new HttpException(409, "Audio Description couldn't be created");

          logger.info('Successfully created new Audio Description for new Video');
          return {
            audioDescriptionId: createNewAudioDescription._id,
            fromAI: false,
          };
        } catch (error) {
          logger.error(error);
          throw new HttpException(409, 'Something went wrong creating audio description.');
        }
      }
      const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne({
        video: videoIdStatus._id,
        user: user._id,
      });
      if (checkIfAudioDescriptionExists) {
        return {
          audioDescriptionId: checkIfAudioDescriptionExists._id,
        };
      }

      // Search for AI Audio Description for specified YouTube Video ID
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
          },
        },
      ]);

      const createNewAudioDescription = new MongoAudio_Descriptions_Model({
        admin_review: false,
        audio_clips: [],
        created_at: nowUtc(),
        language: 'en',
        legacy_notes: '',
        updated_at: nowUtc(),
        video: videoIdStatus._id,
        user: user._id,
      });

      if (!aiUser && aiAudioDescriptions.length <= 0) {
        // No AI Audio Description exists, just create regular empty Audio Description
        createNewAudioDescription.save();
        if (!createNewAudioDescription) throw new HttpException(409, 'Something went wrong when creating audio description.');

        logger.info('Successfully created new Audio Description for existing Video that has no AI Audio Description');
        return {
          audioDescriptionId: createNewAudioDescription._id,
          fromAI: false,
        };
      } else {
        const audioClipArray = [];

        for (let i = 0; i < aiAudioDescriptions[0].video_ad.audio_clips.length; i++) {
          const clip = await MongoAudioClipsModel.findById(aiAudioDescriptions[0].video_ad.audio_clips[i]);
          const createNewAudioClip = new MongoAudioClipsModel({
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
            user: user._id,
            video: videoIdStatus._id,
            is_recorded: false,
          });
          if (!createNewAudioClip) throw new HttpException(409, "Audio Clip couldn't be created");
          audioClipArray.push(createNewAudioClip);
        }

        const createNewAudioClips = await MongoAudioClipsModel.insertMany(audioClipArray);
        if (!createNewAudioClips) throw new HttpException(409, "Audio Clips couldn't be created");
        createNewAudioClips.forEach(async clip => createNewAudioDescription.audio_clips.push(clip));
        createNewAudioClips.forEach(async clip => clip.save());
        createNewAudioDescription.save();
        if (!createNewAudioDescription) throw new HttpException(409, "Audio Description couldn't be created");

        // Add Audio Description to Video Audio Description Array for consistency with old MongodB and YD Classic logic
        await MongoVideosModel.findByIdAndUpdate(videoIdStatus._id, {
          $push: {
            audio_descriptions: {
              $each: [{ _id: createNewAudioDescription._id }],
            },
          },
        }).catch(err => {
          logger.error(err);
          throw new HttpException(409, "Video couldn't be updated.");
        });

        logger.info('Successfully created new Audio Description for existing Video that has an AI Audio Description');
        return {
          audioDescriptionId: createNewAudioDescription._id,
          fromAI: true,
        };
      }
    } else {
      // TODO: Need to update PostgreSQL version to search for AI Audio Description for specified YouTube Video ID
      logger.error('PostgreSQL Version for CreateNewUserAudioDescription() Not Implemented');
      throw new HttpException(500, `Not Implemented Error`);
      // // Check if Video exists
      // const videoIdStatus = await PostGres_Videos.findOne({
      //   where: { youtube_video_id: youtubeVideoId },
      // });
      // if (!videoIdStatus) throw new HttpException(409, "Video doesn't exist");

      // // Check if AUDIO DESCRIPTION already exists
      // const checkIfAudioDescriptionExists = await PostGres_Audio_Descriptions.findOne({
      //   where: { VideoVideoId: videoIdStatus.video_id, UserUserId: userId },
      // });
      // if (checkIfAudioDescriptionExists) throw new HttpException(409, 'Audio Description already exists');

      // // Check if AI USER exists
      // const checkIfAIUserExists = await PostGres_Users.findOne({
      //   where: { user_id: aiUserId },
      // });
      // if (!checkIfAIUserExists) throw new HttpException(409, "AI User doesn't exist");

      // // Check if AI Descriptions exists
      // const checkIfAIDescriptionsExists = await PostGres_Audio_Descriptions.findOne({
      //   where: { VideoVideoId: videoIdStatus.video_id, UserUserId: aiUserId },
      //   include: [
      //     {
      //       model: PostGres_Audio_Clips,
      //       separate: true,
      //       order: ['clip_start_time'],
      //       as: 'Audio_Clips',
      //     },
      //   ],
      // });
      // if (!checkIfAIDescriptionsExists) throw new HttpException(409, "AI Descriptions doesn't exist");
      // // Create new Audio Description
      // const createNewAudioDescription = await PostGres_Audio_Descriptions.create({
      //   VideoVideoId: videoIdStatus.video_id,
      //   UserUserId: userId,
      //   is_published: false,
      // });
      // if (!createNewAudioDescription) throw new HttpException(409, "Audio Description couldn't be created");
      // // Create new Audio Clips
      // const createNewAudioClips = await PostGres_Audio_Clips.bulkCreate(
      //   checkIfAIDescriptionsExists.Audio_Clips.map(clip => {
      //     return {
      //       clip_title: clip.clip_title,
      //       description_type: clip.description_type,
      //       description_text: clip.description_text,
      //       playback_type: clip.playback_type,
      //       clip_start_time: clip.clip_start_time,
      //       is_recorded: false,
      //     };
      //   }),
      // );
      // if (!createNewAudioClips) throw new HttpException(409, "Audio Clips couldn't be created");
      // createNewAudioClips.forEach(async clip => {
      //   createNewAudioDescription.addAudio_Clip(clip);
      // });
      // return {
      //   audioDescriptionId: createNewAudioDescription.ad_id,
      //   fromAI: true,
      // };
    }
  }

  public async createNewUser(newUserData: NewUserDto) {
    if (!newUserData) {
      throw new HttpException(400, 'No data provided');
    }
    const { email, name, given_name, picture, locale, google_user_id, token, opt_in, admin_level, user_type } = newUserData;

    try {
      if (CURRENT_DATABASE === 'mongodb') {
        const user = await MongoUsersModel.findOne({
          google_user_id: google_user_id,
        });

        if (user) {
          const updateduser = await MongoUsersModel.findOneAndUpdate(
            { google_user_id: google_user_id },
            {
              $set: {
                last_login: moment().utc().format('YYYYMMDDHHmmss'),
                updated_at: moment().utc().format('YYYYMMDDHHmmss'),
                token: token,
              },
            },
            { new: true },
          );
          return updateduser;
        } else {
          const newUser = await MongoUsersModel.create({
            email,
            name,
            given_name,
            picture,
            locale,
            google_user_id,
            token,
            opt_in,
            admin_level,
            user_type,
            last_login: moment().utc().format('YYYYMMDDHHmmss'),
          });

          return newUser;
        }
      } else {
        const newUser = await PostGres_Users.create({
          is_ai: false,
          name: name,
          user_email: email,
        });

        return newUser;
      }
    } catch (error) {
      throw new HttpException(409, error);
    }
  }

  public async increaseRequestCount(youtube_id: string, user_id: string, aiUserId: string) {
    try {
      const userIdObject = await MongoUsersModel.findById(user_id);
      const userObjectId = userIdObject._id;

      const captionRequest = await MongoAICaptionRequestModel.findOne({ youtube_id, ai_user_id: aiUserId });

      if (!captionRequest) {
        // If the video has not been requested by anyone yet
        const newCaptionRequest = new MongoAICaptionRequestModel({
          youtube_id,
          ai_user_id: aiUserId,
          status: 'pending',
          caption_requests: [userIdObject],
        });
        await newCaptionRequest.save();
      } else if (!captionRequest.caption_requests.includes(userObjectId)) {
        // If the video has been requested by other users but not by the current user
        captionRequest.caption_requests.push(userObjectId);
        await captionRequest.save();
      }
      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  }

  private async checkIfVideoHasAudioDescription(youtubeVideoId: string, aiUserId: string, userId: string): Promise<boolean | mongoose.Types.ObjectId> {
    const userIdObject = await MongoUsersModel.findById(userId);

    if (!userIdObject) throw new HttpException(409, "User couldn't be found");

    const aiUserObjectId = new ObjectId(aiUserId);

    const videoIdStatus = await getYouTubeVideoStatus(youtubeVideoId);

    if (!videoIdStatus) throw new HttpException(409, "Video couldn't be found in checkIfVideoHasAudioDescription");

    const aiUser = await MongoUsersModel.findById(aiUserObjectId);

    if (!aiUser) throw new HttpException(409, "AI User couldn't be found");

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
    if (aiAudioDescriptions.length === 0) return false;
    const createNewAudioDescription = new MongoAudio_Descriptions_Model({
      admin_review: false,
      audio_clips: [],
      created_at: nowUtc(),
      language: 'en',
      legacy_notes: '',
      updated_at: nowUtc(),
      video: videoIdStatus._id,
      user: userIdObject._id,
    });

    // console.log(`createNewAudioDescription :: ${JSON.stringify(createNewAudioDescription)}`);

    logger.info(`createNewAudioDescription :: ${JSON.stringify(createNewAudioDescription)}`);
    const audioClipArray = [];

    for (let i = 0; i < aiAudioDescriptions[0].video_ad.audio_clips.length; i++) {
      const clipId = aiAudioDescriptions[0].video_ad.audio_clips[i];
      const clip = await MongoAudioClipsModel.findById(clipId);
      // console.log(`Clip :: ${JSON.stringify(clip)}`);
      const createNewAudioClip = new MongoAudioClipsModel({
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
      });
      if (!createNewAudioClip) throw new HttpException(409, "Audio Clip couldn't be created");
      audioClipArray.push(createNewAudioClip);
    }

    const createNewAudioClips = await MongoAudioClipsModel.insertMany(audioClipArray);
    if (!createNewAudioClips) throw new HttpException(409, "Audio Clips couldn't be created");
    createNewAudioClips.forEach(async clip => createNewAudioDescription.audio_clips.push(clip));
    createNewAudioClips.forEach(async clip => clip.save());
    createNewAudioDescription.save();
    if (!createNewAudioDescription) throw new HttpException(409, "Audio Description couldn't be created");

    // Add Audio Description to Video Audio Description Array for consistency with old MongodB and YD Classic logic
    await MongoVideosModel.findByIdAndUpdate(videoIdStatus._id, {
      $push: {
        audio_descriptions: {
          $each: [{ _id: createNewAudioDescription._id }],
        },
      },
    }).catch(err => {
      logger.error(err);
      throw new HttpException(409, "Video couldn't be updated.");
    });

    logger.info('Successfully created new Audio Description for existing Video that has an AI Audio Description');
    return createNewAudioDescription._id;
  }

  public async requestAiDescriptionsWithGpu(userData: IUser, youtube_id: string, ydx_app_host: string) {
    if (!userData) {
      throw new HttpException(400, 'No data provided');
    }
    if (!youtube_id) {
      throw new HttpException(400, 'No youtube_id provided');
    }

    const youtubeVideoData = await getVideoDataByYoutubeId(youtube_id);

    // console.log(`youtubeVideoData ::  ${JSON.stringify(youtubeVideoData)}`);
    logger.info(`youtubeVideoData ::  ${JSON.stringify(youtubeVideoData)}`);

    if (!youtubeVideoData) {
      throw new HttpException(400, 'No youtubeVideoData provided');
    }

    const aiAudioDescriptions = await this.checkIfVideoHasAudioDescription(youtube_id, AI_USER_ID, userData._id);

    if (aiAudioDescriptions) {
      const counterIncrement = await this.increaseRequestCount(youtube_id, userData._id, AI_USER_ID);
      if (!counterIncrement) {
        throw new HttpException(500, 'Error incrementing counter');
      }
      await this.audioClipsService.processAllClipsInDB(aiAudioDescriptions.toString());

      logger.info(`Sending email to ${userData.email}`);

      const YDX_APP_URL = `${ydx_app_host}/editor/${youtube_id}/${aiAudioDescriptions}`;
      // Remove all whitespace from the URL
      const replaced_url = YDX_APP_URL.replace(/\s/g, '');

      logger.info(`URL :: ${YDX_APP_URL}`);

      await sendEmail(
        userData.email,
        `Requested Audio Description for ${youtubeVideoData.title} ready`,
        `Your Audio Description is now available! You're invited to view it by following this link: ${replaced_url}`,
      );

      logger.info(`Email sent to ${userData.email}`);
      return {
        message: 'Audio Description already exists.',
      };
    } else {
      // console.log(`User Data ::  ${JSON.stringify(userData)}`);
      // console.log(
      //   `BODY DATA ::  ${JSON.stringify({
      //     youtube_id: youtube_id,
      //     user_id: userData._id,
      //     ydx_app_host,
      //     ydx_server: CURRENT_YDX_HOST,
      //     AI_USER_ID: AI_USER_ID,
      //   })}`,
      // );
      // console.log(`URL ::${GPU_URL}/generate_ai_caption`);
      logger.info(`URL :: ${GPU_URL}/generate_ai_caption`);

      // Check if video has already been requested

      if (!GPU_URL) throw new HttpException(500, 'GPU_URL is not defined');

      const response = await axios.post(`${GPU_URL}/generate_ai_caption`, {
        youtube_id: youtube_id,
        user_id: userData._id,
        ydx_app_host,
        ydx_server: CURRENT_YDX_HOST,
        AI_USER_ID: AI_USER_ID,
        // user_email: userData.email,
        // user_name: userData.name,
      });
      const counterIncrement = await this.increaseRequestCount(youtube_id, userData._id, AI_USER_ID);

      if (!counterIncrement) {
        throw new HttpException(500, 'Error incrementing counter');
      }

      return response.data;
    }
  }

  private async checkIfAudioDescriptionExistsforUser(
    youtubeVideoId: string,
    userId: string,
  ): Promise<
    | null
    | (IAudioDescription & {
        _id: mongoose.Types.ObjectId;
      })
  > {
    const userIdObject = await MongoUsersModel.findById(userId);

    if (!userIdObject) throw new HttpException(409, "User couldn't be found");

    const videoIdStatus = await getYouTubeVideoStatus(youtubeVideoId);

    if (!videoIdStatus) {
    }
    const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne({
      video: videoIdStatus._id,
      user: userIdObject._id,
    });

    if (checkIfAudioDescriptionExists) return checkIfAudioDescriptionExists;
    else return null;
  }

  public async aiDescriptionStatusUtil(
    user_id: string,
    youtube_id: string,
    ai_user_id: string,
  ): Promise<{ status: string; requested: boolean; url?: string; aiDescriptionId?: string; preview?: boolean }> {
    try {
      if (!user_id || !youtube_id) {
        throw new HttpException(400, 'Missing user_id or youtube_id');
      }

      const userIdObject = await MongoUsersModel.findById(user_id);

      const AIUSEROBJECT = await MongoUsersModel.findById(ai_user_id);

      if (!userIdObject) {
        throw new HttpException(400, 'User not found');
      }

      if (!AIUSEROBJECT) {
        throw new HttpException(400, 'AI User not found');
      }

      const aiAudioDescription = await this.checkIfAudioDescriptionExistsforUser(youtube_id, ai_user_id);

      const captionRequest = await MongoAICaptionRequestModel.findOne({
        youtube_id,
        ai_user_id: ai_user_id,
      });

      if (!captionRequest) {
        return {
          status: 'notavailable',
          requested: false,
        };
      }

      const requested = captionRequest.caption_requests.includes(userIdObject._id);
      const status = captionRequest.status;

      if (!aiAudioDescription && status == 'completed') {
        await MongoAICaptionRequestModel.findOneAndDelete({
          youtube_id,
          ai_user_id: ai_user_id,
        });
        return {
          status: 'notavailable',
          requested: false,
        };
      }

      if (aiAudioDescription && requested && status == 'completed') {
        return {
          url: `editor/${youtube_id}/${aiAudioDescription._id}`,
          status: 'completed',
          requested: true,
          preview: false,
        };
      } else if (aiAudioDescription && !requested && status == 'completed') {
        return {
          url: `preview/${youtube_id}/${aiAudioDescription._id}`,
          status: 'completed',
          requested: false,
          preview: true,
        };
      } else if (!aiAudioDescription && requested && status == 'pending') {
        return {
          status: 'pending',
          requested: true,
        };
      } else if (!aiAudioDescription && !requested && status == 'pending') {
        return {
          status: 'pending',
          requested: false,
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error in aiDescriptionStatusUTIL: ${error.message}`);
        if (error.stack) {
          const lineNumber = error.stack
            .split('\n')[1] // Get the second line of the stack trace
            .match(/:(\d+):(\d+)/); // Extract line and column numbers
          if (lineNumber) {
            logger.error(`Error occurred at line ${lineNumber[1]}`);
          }
        }
      }
      logger.error(`Error in aiDescriptionStatusUTIL: ${error.message}`);
      throw error;
    }
  }

  public async aiDescriptionStatus(user_id: string, youtube_id: string): Promise<{ status: string; requested: boolean; url?: string }> {
    try {
      const response = await this.aiDescriptionStatusUtil(user_id, youtube_id, AI_USER_ID);
      return response;
    } catch (error) {
      logger.error(`Error in aiDescriptionStatus: ${error.message}`);
      throw error;
    }
  }

  public async generateAudioDescGpu(newUserAudioDescription: CreateUserAudioDescriptionDto, user_id: string) {
    const { youtubeVideoId, aiUserId } = newUserAudioDescription;

    if (!youtubeVideoId) throw new HttpException(400, 'youtubeVideoId is empty');
    if (!aiUserId) throw new HttpException(400, 'aiUserId is empty');

    const videoIdStatus = await getYouTubeVideoStatus(youtubeVideoId);
    // console.log(`videoIdStatus :: ${JSON.stringify(videoIdStatus._id)}`);
    const userIdObject = await MongoUsersModel.findById(user_id);
    // console.log(`userIdObject :: ${JSON.stringify(userIdObject._id)}`);
    const aiUserObjectId = new ObjectId(aiUserId);

    const aiUser = await MongoUsersModel.findById(aiUserObjectId);

    const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne({
      video: videoIdStatus._id,
      user: userIdObject._id,
    });
    if (checkIfAudioDescriptionExists) {
      return {
        audioDescriptionId: checkIfAudioDescriptionExists._id,
      };
    }

    // Search for AI Audio Description for specified YouTube Video ID
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

    // console.log(`aiAudioDescriptions :: ${JSON.stringify(aiAudioDescriptions)}`);

    const createNewAudioDescription = new MongoAudio_Descriptions_Model({
      admin_review: false,
      audio_clips: [],
      created_at: nowUtc(),
      language: 'en',
      legacy_notes: '',
      updated_at: nowUtc(),
      video: videoIdStatus._id,
      user: userIdObject._id,
    });

    // console.log(`createNewAudioDescription :: ${JSON.stringify(createNewAudioDescription)}`);

    logger.info(`createNewAudioDescription :: ${JSON.stringify(createNewAudioDescription)}`);
    const audioClipArray = [];

    for (let i = 0; i < aiAudioDescriptions[0].video_ad.audio_clips.length; i++) {
      const clipId = aiAudioDescriptions[0].video_ad.audio_clips[i];
      const clip = await MongoAudioClipsModel.findById(clipId);
      // console.log(`Clip :: ${JSON.stringify(clip)}`);
      const createNewAudioClip = new MongoAudioClipsModel({
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
      });
      if (!createNewAudioClip) throw new HttpException(409, "Audio Clip couldn't be created");
      audioClipArray.push(createNewAudioClip);
    }

    const createNewAudioClips = await MongoAudioClipsModel.insertMany(audioClipArray);
    if (!createNewAudioClips) throw new HttpException(409, "Audio Clips couldn't be created");
    createNewAudioClips.forEach(async clip => createNewAudioDescription.audio_clips.push(clip));
    createNewAudioClips.forEach(async clip => clip.save());
    createNewAudioDescription.save();
    if (!createNewAudioDescription) throw new HttpException(409, "Audio Description couldn't be created");

    // Add Audio Description to Video Audio Description Array for consistency with old MongodB and YD Classic logic
    await MongoVideosModel.findByIdAndUpdate(videoIdStatus._id, {
      $push: {
        audio_descriptions: {
          $each: [{ _id: createNewAudioDescription._id }],
        },
      },
    }).catch(err => {
      logger.error(err);
      throw new HttpException(409, "Video couldn't be updated.");
    });

    logger.info('Successfully created new Audio Description for existing Video that has an AI Audio Description');
    return {
      audioDescriptionId: createNewAudioDescription._id,
      fromAI: true,
    };
  }

  public async getAllAiDescriptionRequests(user_id: string, pageNumber: string, paginate: boolean) {
    if (!user_id) {
      throw new HttpException(400, 'No data provided');
    }

    try {
      const userIdObject = await MongoUsersModel.findById(user_id);
      let aiAudioDescriptions;
      if (paginate) {
        const page = parseInt(pageNumber, 10);
        const perPage = 4;
        const skipCount = Math.max((page - 1) * perPage, 0);

        aiAudioDescriptions = await MongoAICaptionRequestModel.find({ caption_requests: userIdObject._id }).sort({ _id: -1 }).skip(skipCount).limit(perPage);
      } else {
        aiAudioDescriptions = await this.getAllAiDescriptionRequestsAllVideos(user_id);
      }

      const return_arr = [];
      for (const element of aiAudioDescriptions) {
        const videoIdStatus = await MongoVideosModel.findOne({ youtube_id: element.youtube_id });
        const response = await this.processAiAudioDescription(user_id, element, videoIdStatus);
        return_arr.push(response);
      }

      const totalItemCount = await MongoAICaptionRequestModel.countDocuments({ caption_requests: userIdObject._id });

      return {
        result: return_arr,
        totalVideos: totalItemCount,
      };
    } catch (error) {
      return error;
    }
  }

  private async getAllAiDescriptionRequestsAllVideos(user_id: string) {
    const userIdObject = await MongoUsersModel.findById(user_id);
    return MongoAICaptionRequestModel.find({ caption_requests: userIdObject._id }).sort({ _id: -1 });
  }

  private async processAiAudioDescription(user_id: string, element, videoIdStatus) {
    const response = {
      video_id: videoIdStatus._id,
      youtube_video_id: element.youtube_id,
      video_name: videoIdStatus.title,
      video_length: videoIdStatus.duration,
      createdAt: videoIdStatus.created_at,
      updatedAt: videoIdStatus.updated_at,
      status: 'requested',
      requested: true,
      url: null,
    };

    if (element.status === 'completed') {
      const aiDescriptionStatus = await this.aiDescriptionStatusUtil(user_id, element.youtube_id, element.ai_user_id);
      response.status = aiDescriptionStatus.status;
      response.requested = aiDescriptionStatus.requested;
      response.url = aiDescriptionStatus.url;
    }

    return response;
  }

  public async saveVisitedVideosHistory(user_id: string, youtube_id: string) {
    try {
      if (!user_id || !youtube_id) {
        throw new HttpException(400, 'No data provided');
      }

      const userDocument = await MongoHistoryModel.findOne({ user: user_id });
      if (userDocument) {
        if (!userDocument.visited_videos.includes(youtube_id)) {
          userDocument.visited_videos.push(youtube_id);
          await MongoHistoryModel.updateOne({ _id: userDocument._id }, { $set: { visited_videos: userDocument.visited_videos } });
        } else {
          // console.log(`Video with ID ${youtube_id} already exists in history for user ${user_id}`);
        }

        return userDocument.visited_videos;
      } else {
        const newUserDocument = {
          user: user_id,
          visited_videos: [youtube_id],
        };

        const insertedDocument = await MongoHistoryModel.create(newUserDocument);

        return insertedDocument.visited_videos;
      }
    } catch (error) {
      console.error('Error:', error);
      return error;
    }
  }

  public async getVisitedVideosHistory(user_id: string, pageNumber: string, paginate: boolean) {
    if (!user_id) {
      throw new HttpException(400, 'No data provided');
    }

    const page = parseInt(pageNumber, 10);
    const perPage = 4;
    const skipCount = Math.max((page - 1) * perPage, 0);
    const userIdObject = await MongoUsersModel.findById(user_id);
    const visitedVideosHistory = await MongoHistoryModel.find({
      user: userIdObject._id,
    });

    const visitedVideosArray = [...new Set(visitedVideosHistory.flatMap(history => history.visited_videos))];
    visitedVideosArray.reverse();
    const videos = [];
    const adjustedSkipCount = skipCount;

    for (let i = adjustedSkipCount; i < visitedVideosArray.length && videos.length < perPage; i++) {
      const youtube_id = visitedVideosArray[i];

      try {
        const existingVideo = (await MongoVideosModel.findOne({ youtube_id })) || (await getYouTubeVideoStatus(youtube_id));
        // console.log(existingVideo ? 'existingVideo' : 'FETCHED VIDEO', existingVideo);

        if (existingVideo) {
          videos.push(existingVideo);
        }
      } catch (error) {
        // console.log('ERROR', error);

        await MongoHistoryModel.updateOne({ user: userIdObject._id }, { $pull: { visited_videos: youtube_id } });
      }
    }

    const videoIds = videos.map(videoId => videoId._id);
    const audioDescription = await MongoAudio_Descriptions_Model.find({ video: { $in: videoIds } });
    const resultVideos = videos.map(video => {
      const { _id, youtube_id, title, duration, created_at, updated_at } = video;
      const descriptions = audioDescription.find(ad => ad.video.toString() === _id.toString());

      return {
        video_id: _id,
        youtube_video_id: youtube_id,
        video_name: title,
        video_length: duration,
        createdAt: created_at,
        updatedAt: updated_at,
        audio_description_id: descriptions ? descriptions._id : null,
        status: descriptions ? descriptions.status : null,
        overall_rating_votes_average: descriptions ? descriptions.overall_rating_votes_average : null,
        overall_rating_votes_counter: descriptions ? descriptions.overall_rating_votes_counter : null,
        overall_rating_votes_sum: descriptions ? descriptions.overall_rating_votes_sum : null,
      };
    });

    return { result: resultVideos, totalVideos: visitedVideosArray.length };
  }
}

export default UserService;
