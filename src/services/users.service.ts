import { CreateUserAudioDescriptionDto, CreateUserDto, NewUserDto } from '../dtos/users.dto';
import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE, CURRENT_YDX_HOST, GPU_HOST, GPU_PIPELINE_PORT, AI_USER_ID } from '../config';
import { PostGres_Users, UsersAttributes } from '../models/postgres/init-models';
import { PostGres_Videos } from '../models/postgres/init-models';
import { PostGres_Audio_Descriptions } from '../models/postgres/init-models';
import { PostGres_Audio_Clips } from '../models/postgres/init-models';
import {
  MongoAICaptionRequestModel,
  MongoAudioClipsModel,
  MongoAudio_Descriptions_Model,
  MongoUsersModel,
  MongoVideosModel,
} from '../models/mongodb/init-models.mongo';
import { IUser } from '../models/mongodb/User.mongo';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import { logger } from '../utils/logger';
import { getVideoDataByYoutubeId, isVideoAvailable } from './videos.util';
import moment from 'moment';
import axios from 'axios';
import mongoose, { Schema } from 'mongoose';
import AudioClipsService from './audioClips.service';
import { ObjectId } from 'mongodb';
import sendEmail from '../utils/emailService';

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
      const videoIdStatus = await MongoVideosModel.findOne({ youtube_id: youtubeVideoId });
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
            updated_at: new Date(),
          });
          const newSavedVideo = await newVideo.save();
          if (!newSavedVideo) throw new HttpException(409, "Video couldn't be created");

          const createNewAudioDescription = new MongoAudio_Descriptions_Model({
            admin_review: false,
            audio_clips: [],
            created_at: new Date(),
            language: 'en',
            legacy_notes: '',
            updated_at: new Date(),
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
        created_at: new Date(),
        language: 'en',
        legacy_notes: '',
        updated_at: new Date(),
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
            created_at: new Date(),
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
            updated_at: new Date(),
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

  private async checkIfVideoHasAudioDescription(youtubeVideoId: string, aiUserId: string, userId: string) {
    const userIdObject = await MongoUsersModel.findById(userId);

    if (!userIdObject) throw new HttpException(409, "User couldn't be found");

    const aiUserObjectId = new ObjectId(aiUserId);
    const videoIdStatus = await MongoVideosModel.findOne({ youtube_id: youtubeVideoId });

    if (!videoIdStatus) throw new HttpException(409, "Video couldn't be found");

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
      created_at: new Date(),
      language: 'en',
      legacy_notes: '',
      updated_at: new Date(),
      video: videoIdStatus._id,
      user: userIdObject._id,
    });

    console.log(`createNewAudioDescription :: ${JSON.stringify(createNewAudioDescription)}`);

    logger.info(`createNewAudioDescription :: ${JSON.stringify(createNewAudioDescription)}`);
    const audioClipArray = [];

    for (let i = 0; i < aiAudioDescriptions[0].video_ad.audio_clips.length; i++) {
      const clipId = aiAudioDescriptions[0].video_ad.audio_clips[i];
      const clip = await MongoAudioClipsModel.findById(clipId);
      console.log(`Clip :: ${JSON.stringify(clip)}`);
      const createNewAudioClip = new MongoAudioClipsModel({
        audio_description: createNewAudioDescription._id,
        created_at: new Date(),
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
        updated_at: new Date(),
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

  public async requestAiDescriptionsWithGpu(userData: IUser, youtube_id: string, ydx_app_host: string) {
    if (!userData) {
      throw new HttpException(400, 'No data provided');
    }
    if (!youtube_id) {
      throw new HttpException(400, 'No youtube_id provided');
    }

    const youtubeVideoData = await getVideoDataByYoutubeId(youtube_id);

    console.log(`youtubeVideoData ::  ${JSON.stringify(youtubeVideoData)}`);
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
      const { audioDescriptionId } = aiAudioDescriptions;
      await this.audioClipsService.processAllClipsInDB(audioDescriptionId.audioDescriptionId.toString());

      logger.info(`Sending email to ${userData.email}`);

      const YDX_APP_URL = `${ydx_app_host}/editor/${youtube_id}/${audioDescriptionId.audioDescriptionId}`;
      // Remove all whitespace from the URL
      const replaced_url = YDX_APP_URL.replace(/\s/g, '');

      logger.info(`URL :: ${YDX_APP_URL}`);

      await sendEmail(
        userData.email,
        `Requested Audio Description for ${youtubeVideoData.title} ready`,
        `Your Audio Description is now available! You're invited to view it by following this link: ${YDX_APP_URL}`,
      );

      logger.info(`Email sent to ${userData.email}`);
    } else {
      console.log(`User Data ::  ${JSON.stringify(userData)}`);
      console.log(
        `BODY DATA ::  ${JSON.stringify({
          youtube_id: youtube_id,
          user_id: userData._id,
          ydx_app_host,
          ydx_server: CURRENT_YDX_HOST,
          AI_USER_ID: AI_USER_ID,
        })}`,
      );
      console.log(`URL :: http://${GPU_HOST}:${GPU_PIPELINE_PORT}/generate_ai_caption`);
      logger.info(`URL :: http://${GPU_HOST}:${GPU_PIPELINE_PORT}/generate_ai_caption`);

      // Check if video has already been requested

      const response = await axios.post(`http://${GPU_HOST}:${GPU_PIPELINE_PORT}/generate_ai_caption`, {
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
  public async aiDescriptionStatus(user_id: string, youtube_id: string): Promise<{ status: string; requested: boolean; url?: string }> {
    try {
      if (!user_id || !youtube_id) {
        throw new HttpException(400, 'Missing user_id or youtube_id');
      }

      const userIdObject = await MongoUsersModel.findById(user_id);

      if (!userIdObject) {
        throw new HttpException(400, 'User not found');
      }

      const captionRequest = await MongoAICaptionRequestModel.findOne({
        youtube_id,
        ai_user_id: AI_USER_ID,
      });

      if (!captionRequest) {
        throw new HttpException(404, 'Caption request not found');
      }

      const requested = captionRequest.caption_requests.includes(userIdObject._id);

      console.log(`captionRequest.status :: ${captionRequest.status}`);
      logger.info(`captionRequest.status :: ${captionRequest.status}`);

      if (requested && captionRequest.status === 'completed') {
        const videoIdStatus = await MongoVideosModel.findOne({ youtube_id });

        if (!videoIdStatus) {
          throw new HttpException(404, 'Video not found');
        }

        const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne({
          video: videoIdStatus._id,
          user: userIdObject,
        });

        if (checkIfAudioDescriptionExists) {
          return {
            status: captionRequest.status,
            requested: true,

            url: `${youtube_id}/${checkIfAudioDescriptionExists._id}`,
          };
        }
        logger.info('Successfully created new Audio Description for existing Video that has an AI Audio Description');
        return {
          status: captionRequest.status,
          requested: true,
        };
      }

      return { status: captionRequest.status, requested };
    } catch (error) {
      // Handle errors here or log them using your logger library.
      logger.error(`Error in aiDescriptionStatus: ${error.message}`);
      throw error;
    }
  }

  public async generateAudioDescGpu(newUserAudioDescription: CreateUserAudioDescriptionDto, user_id: string) {
    const { youtubeVideoId, aiUserId } = newUserAudioDescription;

    if (!youtubeVideoId) throw new HttpException(400, 'youtubeVideoId is empty');
    if (!aiUserId) throw new HttpException(400, 'aiUserId is empty');

    const videoIdStatus = await MongoVideosModel.findOne({ youtube_id: youtubeVideoId });
    console.log(`videoIdStatus :: ${JSON.stringify(videoIdStatus._id)}`);
    const userIdObject = await MongoUsersModel.findById(user_id);
    console.log(`userIdObject :: ${JSON.stringify(userIdObject._id)}`);
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

    console.log(`aiAudioDescriptions :: ${JSON.stringify(aiAudioDescriptions)}`);

    const createNewAudioDescription = new MongoAudio_Descriptions_Model({
      admin_review: false,
      audio_clips: [],
      created_at: new Date(),
      language: 'en',
      legacy_notes: '',
      updated_at: new Date(),
      video: videoIdStatus._id,
      user: userIdObject._id,
    });

    console.log(`createNewAudioDescription :: ${JSON.stringify(createNewAudioDescription)}`);

    logger.info(`createNewAudioDescription :: ${JSON.stringify(createNewAudioDescription)}`);
    const audioClipArray = [];

    for (let i = 0; i < aiAudioDescriptions[0].video_ad.audio_clips.length; i++) {
      const clipId = aiAudioDescriptions[0].video_ad.audio_clips[i];
      const clip = await MongoAudioClipsModel.findById(clipId);
      console.log(`Clip :: ${JSON.stringify(clip)}`);
      const createNewAudioClip = new MongoAudioClipsModel({
        audio_description: createNewAudioDescription._id,
        created_at: new Date(),
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
        updated_at: new Date(),
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

  public async getAllAiDescriptionRequests(user_id: string) {
    if (!user_id) {
      throw new HttpException(400, 'No data provided');
    }

    const userIdObject = await MongoUsersModel.findById(user_id);

    const aiAudioDescriptions = await MongoAICaptionRequestModel.aggregate([
      {
        $match: {
          caption_requests: userIdObject,
        },
      },
      {
        $unwind: '$caption_requests',
      },
      {
        $lookup: {
          from: 'videos',
          localField: 'youtube_id',
          foreignField: 'youtube_id',
          as: 'video',
        },
      },
    ]);

    console.log(`aiAudioDescriptions ::  ${JSON.stringify(aiAudioDescriptions)}`);
    logger.info(`aiAudioDescriptions ::  ${JSON.stringify(aiAudioDescriptions)}`);

    return aiAudioDescriptions;
  }
}

export default UserService;
