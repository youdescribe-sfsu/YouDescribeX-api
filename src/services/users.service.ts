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
import { getVideoDataByYoutubeId, isVideoAvailable } from '../utils/videos.util';
import axios from 'axios';
import mongoose from 'mongoose';
import AudioClipsService from './audioClips.service';
import { ObjectId } from 'mongodb';
import sendEmail from '../utils/emailService';
import { IAudioDescription } from '../models/mongodb/AudioDescriptions.mongo';
import { VideoNotFoundError, AIProcessingError } from '../utils/customErrors';
import moment from 'moment';
import { PipelineFailureDto } from '../dtos/pipelineFailure.dto';

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
      const findUser = await MongoUsersModel.findOne({ email: userEmail });
      if (!findUser) throw new HttpException(409, "User doesn't exist");
      return findUser;
    } else {
      const findUser = await PostGres_Users.findOne({ where: { user_email: userEmail } });
      if (!findUser) throw new HttpException(409, "User doesn't exist");
      return findUser;
    }
  }

  public async createUser(userData: CreateUserDto): Promise<IUser | UsersAttributes> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findUser = await MongoUsersModel.findOne({ email: userData.email });
      if (findUser) throw new HttpException(409, `This email ${userData.email} already exists`);
      const createUserData = await MongoUsersModel.create({
        user_type: userData.isAI ? 'AI' : 'Volunteer',
        admin_level: 0,
        email: userData.email,
        name: userData.name,
      });
      return createUserData;
    } else {
      const findUser = await PostGres_Users.findOne({ where: { user_email: userData.email } });
      if (findUser) throw new HttpException(409, `This email ${userData.email} already exists`);
      const createUserData = await PostGres_Users.create({
        is_ai: false,
        name: userData.name,
        user_email: userData.email,
      });
      return createUserData;
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

  public async handlePipelineFailure(failureData: PipelineFailureDto): Promise<void> {
    const { youtube_id, ai_user_id, error_message, ydx_app_host } = failureData;

    console.log(`Handling pipeline failure for YouTube ID: ${youtube_id}, AI User ID: ${ai_user_id}`);

    // Notify user about the failure
    console.log('Starting user notification process...');
    await this.notifyUserAboutFailure(youtube_id, ai_user_id, ydx_app_host);

    // Log the failure
    console.error(`Pipeline failed for video ${youtube_id}: ${error_message}`);

    console.log('Pipeline failure handling completed.');
  }

  private async cleanupMongoDbEntry(youtube_id: string, ai_user_id: string) {
    console.log(`Starting cleanup for YouTube ID: ${youtube_id}, AI User ID: ${ai_user_id}`);

    try {
      // Remove entry from MongoAICaptionRequestModel
      console.log('Removing entry from MongoAICaptionRequestModel...');
      const deleteResult = await MongoAICaptionRequestModel.deleteOne({ youtube_id, ai_user_id });
      console.log(`Deleted ${deleteResult.deletedCount} entries from MongoAICaptionRequestModel`);

      // Remove associated audio description
      const video = await MongoVideosModel.findOne({ youtube_id });
      if (video) {
        console.log(`Found video for YouTube ID: ${youtube_id}`);

        const aiUser = await MongoUsersModel.findById(ai_user_id);
        if (aiUser) {
          console.log(`Found AI user for ID: ${ai_user_id}`);

          const audioDescription = await MongoAudio_Descriptions_Model.findOne({
            video: video._id,
            user: aiUser._id,
          });

          if (audioDescription) {
            console.log(`Found audio description for video ${youtube_id}`);

            // Remove audio clips associated with this audio description
            console.log('Removing associated audio clips...');
            const deleteClipsResult = await MongoAudioClipsModel.deleteMany({ audio_description: audioDescription._id });
            console.log(`Deleted ${deleteClipsResult.deletedCount} audio clips`);

            // Remove the audio description itself
            console.log('Removing audio description...');
            const deleteDescResult = await MongoAudio_Descriptions_Model.deleteOne({ _id: audioDescription._id });
            console.log(`Deleted ${deleteDescResult.deletedCount} audio descriptions`);

            // Remove the audio description reference from the video
            console.log('Updating video document...');
            const updateResult = await MongoVideosModel.updateOne({ _id: video._id }, { $pull: { audio_descriptions: audioDescription._id } });
            console.log(`Updated ${updateResult.modifiedCount} video documents`);
          } else {
            console.log('No audio description found for this video and AI user');
          }
        } else {
          console.log(`AI user not found for ID: ${ai_user_id}`);
        }
      } else {
        console.log(`Video not found for YouTube ID: ${youtube_id}`);
      }

      console.log('MongoDB cleanup completed successfully');
    } catch (error) {
      console.error(`Error cleaning up MongoDB entries: ${error.message}`);
      console.error(error.stack);
    }
  }

  private async notifyUserAboutFailure(youtube_id: string, ai_user_id: string, ydx_app_host: string) {
    console.log(`Starting user notification process for YouTube ID: ${youtube_id}`);

    try {
      const captionRequest = await MongoAICaptionRequestModel.findOne({ youtube_id, ai_user_id });
      if (captionRequest) {
        console.log(`Found caption request for YouTube ID: ${youtube_id}`);

        const video = await MongoVideosModel.findOne({ youtube_id });
        const videoTitle = video ? video.title : 'Unknown Video';
        console.log(`Video title: ${videoTitle}`);

        for (const userId of captionRequest.caption_requests) {
          const user = await MongoUsersModel.findById(userId);
          if (user && user.email) {
            console.log(`Sending notification email to user: ${user.email}`);

            await sendEmail(user.email, `Video Processing Error - We're Working on It!`, this.getErrorNotificationEmailBody(user.name, videoTitle, youtube_id));

            console.log(`Notification email sent to user: ${user.email}`);
          } else {
            console.log(`User not found or email not available for user ID: ${userId}`);
          }
        }
        // Clean up MongoDB entry
        console.log('Starting MongoDB cleanup...');
        await this.cleanupMongoDbEntry(youtube_id, ai_user_id);
      } else {
        console.log(`No caption request found for YouTube ID: ${youtube_id}`);
      }

      console.log('User notification process completed');
    } catch (error) {
      console.error(`Error notifying users about failure: ${error.message}`);
      console.error(error.stack);
    }
  }

  private getErrorNotificationEmailBody(userName: string, videoTitle: string, youtube_id: string) {
    return `
      Dear ${userName},
      
      We encountered an unexpected issue while processing your requested video "${videoTitle}" (YouTube ID: ${youtube_id}).
      
      Rest assured, our team has been automatically notified and is actively working to resolve this issue. We appreciate your patience and understanding.
      
      Once the issue is resolved, we'll restart the processing of your video and notify you when it's ready.
      
      Thank you for being a valued member of the YouDescribe community.
      
      Best regards,
      The YouDescribe Team
  `;
  }

  private async processAiDescriptionRequest(userData: IUser, youtube_id: string, ydx_app_host: string, youtubeVideoData: any) {
    try {
      const aiAudioDescriptions = await this.checkIfVideoHasAudioDescription(youtube_id, AI_USER_ID, userData._id);

      if (aiAudioDescriptions) {
        await this.handleExistingAudioDescription(userData, youtube_id, ydx_app_host, youtubeVideoData, aiAudioDescriptions);
      } else {
        await this.initiateNewAudioDescription(userData, youtube_id, ydx_app_host, youtubeVideoData);
      }
    } catch (error) {
      logger.error(`Error in processAiDescriptionRequest: ${error.message}`, {
        userId: userData._id,
        youtubeId: youtube_id,
        error: error,
      });
      // Optionally, handle the error, such as sending a notification to the user or admin
    }
  }

  public async checkAIServiceAvailability() {
    try {
      if (!GPU_URL) {
        return { available: false, reason: 'GPU service not configured' };
      }

      const response = await axios.get(`${GPU_URL}/health_check`, { timeout: 5000 });
      return {
        available: response.status === 200,
        reason: response.status === 200 ? 'Service available' : 'Service unavailable',
      };
    } catch (error) {
      logger.error('AI service health check failed:', error);
      return { available: false, reason: 'Service unavailable' };
    }
  }

  public async requestAiDescriptionsWithGpu(userData: IUser, youtube_id: string, ydx_app_host: string) {
    try {
      logger.info(`Starting AI description request for video ${youtube_id}`, { userId: userData._id });

      // First check if the service is available
      const serviceStatus = await this.checkAIServiceAvailability();
      if (!serviceStatus.available) {
        throw new HttpException(503, 'AI service is currently unavailable');
      }

      const youtubeVideoData = await getVideoDataByYoutubeId(youtube_id);
      if (!youtubeVideoData) {
        throw new VideoNotFoundError(`No data found for YouTube ID: ${youtube_id}`);
      }

      logger.info(`Video data retrieved for ${youtube_id}`, { videoTitle: youtubeVideoData.title });

      // Return immediate response
      const response = {
        message: 'Your request has been received and is being processed.',
        status: 'pending',
      };

      // Process in background
      this.processAiDescriptionRequest(userData, youtube_id, ydx_app_host, youtubeVideoData).catch(error => {
        logger.error('Background processing failed:', error);
      });

      return response;
    } catch (error) {
      logger.error(`Error in requestAiDescriptionsWithGpu: ${error.message}`, {
        userId: userData._id,
        youtubeId: youtube_id,
        error: error,
      });

      if (error instanceof VideoNotFoundError) {
        throw new HttpException(404, error.message);
      } else if (error instanceof AIProcessingError) {
        throw new HttpException(503, 'AI processing service is currently unavailable');
      } else if (error instanceof HttpException) {
        throw error;
      } else {
        throw new HttpException(500, 'An unexpected error occurred');
      }
    }
  }

  private async handleExistingAudioDescription(userData: IUser, youtube_id: string, ydx_app_host: string, youtubeVideoData: any, aiAudioDescriptions: any) {
    const counterIncrement = await this.increaseRequestCount(youtube_id, userData._id, AI_USER_ID);
    if (!counterIncrement) {
      throw new AIProcessingError('Error incrementing counter');
    }
    await this.audioClipsService.processAllClipsInDB(aiAudioDescriptions.toString());

    logger.info(`Sending email to ${userData.email}`);

    const YDX_APP_URL = `${ydx_app_host}/editor/${youtube_id}/${aiAudioDescriptions}`;
    const replaced_url = YDX_APP_URL.replace(/\s/g, '');

    logger.info(`URL :: ${YDX_APP_URL}`);

    await sendEmail(
      userData.email,
      `🎉 Audio Description Ready !!! Your Audio Description for "${youtubeVideoData.title}" is Ready to Explore!`,
      this.getExistingAudioDescriptionEmailBody(userData.name, youtubeVideoData.title, replaced_url),
    );

    logger.info(`Email sent to ${userData.email}`);
    return {
      message: 'Audio Description already exists.',
    };
  }

  private async initiateNewAudioDescription(userData: IUser, youtube_id: string, ydx_app_host: string, youtubeVideoData: any) {
    logger.info(`Initiating new audio description for ${youtube_id}`);

    if (!GPU_URL) throw new AIProcessingError('GPU_URL is not defined');

    const response = await axios.post(`${GPU_URL}/generate_ai_caption`, {
      youtube_id: youtube_id,
      user_id: userData._id,
      ydx_app_host,
      ydx_server: CURRENT_YDX_HOST,
      AI_USER_ID: AI_USER_ID,
    });

    const counterIncrement = await this.increaseRequestCount(youtube_id, userData._id, AI_USER_ID);

    if (!counterIncrement) {
      throw new AIProcessingError('Error incrementing counter');
    }

    await sendEmail(
      userData.email,
      `🎬 AI Description for "${youtubeVideoData.title}" is in the Works!`,
      this.getNewAudioDescriptionEmailBody(userData.name, youtubeVideoData.title),
    );

    return response.data;
  }

  private async handleError(userData: IUser, youtube_id: string, videoTitle: string) {
    await this.sendErrorNotificationEmail(userData, youtube_id, videoTitle);
    await this.cleanupDatabaseEntry(youtube_id, AI_USER_ID);
  }

  private async sendErrorNotificationEmail(userData: IUser, youtube_id: string, videoTitle: string) {
    const emailSubject = `Video Processing Error - We're Working on It!`;
    const emailBody = this.getErrorNotificationEmailBody(userData.name, videoTitle, youtube_id);

    await sendEmail(userData.email, emailSubject, emailBody);
    logger.info(`Error notification email sent to ${userData.email}`);
  }

  private async cleanupDatabaseEntry(youtube_id: string, AI_USER_ID: string) {
    try {
      await MongoAICaptionRequestModel.deleteOne({ youtube_id, AI_USER_ID });
      logger.info(`Database entry cleaned up for YouTube ID: ${youtube_id}`);
    } catch (dbError) {
      logger.error(`Error cleaning up database entry: ${dbError.message}`);
    }
  }

  private getExistingAudioDescriptionEmailBody(userName: string, videoTitle: string, url: string) {
    return `
      Dear ${userName},
      
      Great news! Your requested audio description for "${videoTitle}" is now available and waiting for you to experience.
      
      We're excited for you to dive into this enhanced version of the video. Your audio description is ready to bring new dimensions to your viewing experience, offering rich details and nuanced narration.
      
      Ready to explore? Simply click or copy and paste the link below to start your journey:
      
      ${url}
      
      Thank you for being part of the YouDescribe community. Your engagement helps make online content more accessible for everyone.
      
      Enjoy your enhanced video experience!
      
      Best regards,
      The YouDescribe Team
        `;
  }

  private getNewAudioDescriptionEmailBody(userName: string, videoTitle: string) {
    return `
      Dear ${userName},
      
      Great news! We've received your request for an AI-generated audio description of "${videoTitle}". Our advanced AI is now hard at work crafting a detailed and engaging description just for you.
      
      Here's what's happening:
      
      - Our AI is analyzing the video content
      - It's identifying key visual elements and actions
      - Soon, it will generate a comprehensive audio description
      
      We'll notify you as soon as your AI-enhanced audio description is ready to explore. This may take some time, depending on the video's length and complexity.
      
      In the meantime, why not explore other audio-described videos on YouDescribe? There's always something new to discover!
      
      Thank you for your patience and for being a valued member of the YouDescribe community. Your request helps us improve our AI and make more content accessible to everyone.
      
      Stay tuned for your enhanced viewing experience!
      
      Best regards,
      The YouDescribe Team
        `;
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

    logger.info(`createNewAudioDescription :: ${JSON.stringify(createNewAudioDescription)}`);
    const audioClipArray = [];

    for (let i = 0; i < aiAudioDescriptions[0].video_ad.audio_clips.length; i++) {
      const clipId = aiAudioDescriptions[0].video_ad.audio_clips[i];
      const clip = await MongoAudioClipsModel.findById(clipId);
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

  public async increaseRequestCount(youtube_id: string, user_id: string, aiUserId: string) {
    try {
      const userIdObject = await MongoUsersModel.findById(user_id);
      const userObjectId = userIdObject._id;

      const captionRequest = await MongoAICaptionRequestModel.findOne({ youtube_id, ai_user_id: aiUserId });

      if (!captionRequest) {
        const newCaptionRequest = new MongoAICaptionRequestModel({
          youtube_id,
          ai_user_id: aiUserId,
          status: 'pending',
          caption_requests: [userIdObject],
        });
        await newCaptionRequest.save();
      } else if (!captionRequest.caption_requests.includes(userObjectId)) {
        captionRequest.caption_requests.push(userObjectId);
        await captionRequest.save();
      }
      return true;
    } catch (error) {
      logger.error('Error:', error);
      return false;
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

  private async aiDescriptionStatusUtil(
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
          aiDescriptionId: aiAudioDescription._id,
          status: 'completed',
          requested: true,
          preview: false,
        };
      } else if (aiAudioDescription && !requested && status == 'completed') {
        return {
          url: `preview/${youtube_id}/${aiAudioDescription._id}`,
          aiDescriptionId: aiAudioDescription._id,
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
          const lineNumber = error.stack.split('\n')[1].match(/:(\d+):(\d+)/);
          if (lineNumber) {
            logger.error(`Error occurred at line ${lineNumber[1]}`);
          }
        }
      }
      logger.error(`Error in aiDescriptionStatusUTIL: ${error.message}`);
      throw error;
    }
  }

  private async checkIfAudioDescriptionExistsforUser(
    youtubeVideoId: string,
    userId: string,
  ): Promise<null | (IAudioDescription & { _id: mongoose.Types.ObjectId })> {
    const userIdObject = await MongoUsersModel.findById(userId);

    if (!userIdObject) throw new HttpException(409, "User couldn't be found");

    const videoIdStatus = await getYouTubeVideoStatus(youtubeVideoId);

    if (!videoIdStatus) {
      return null;
    }
    const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne({
      video: videoIdStatus._id,
      user: userIdObject._id,
    });

    if (checkIfAudioDescriptionExists) return checkIfAudioDescriptionExists;
    else return null;
  }

  public async getUserAiDescriptionRequests(user_id: string, pageNumber: string, paginate: boolean) {
    if (!user_id) {
      throw new HttpException(400, 'No data provided');
    }

    try {
      const page = parseInt(pageNumber, 10) || 1;
      const perPage = paginate ? 4 : 20;
      const skipCount = Math.max((page - 1) * perPage, 0);

      const pipeline: any[] = [
        { $match: { caption_requests: new ObjectId(user_id) } },
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
            audio_description_id: { $first: '$_id' },
            video: { $first: '$video' },
          },
        },
        {
          $project: {
            _id: 1,
            status: 1,
            audio_description_id: 1,
            video_id: '$video._id',
            youtube_video_id: '$video.youtube_id',
            video_name: '$video.title',
            video_length: '$video.duration',
            createdAt: '$video.created_at',
            updatedAt: '$video.updated_at',
            overall_rating_votes_average: 1,
            overall_rating_votes_counter: 1,
            overall_rating_votes_sum: 1,
          },
        },
        { $sort: { _id: -1 } },
        {
          $facet: {
            totalCount: [{ $count: 'count' }],
            paginatedResults: [{ $skip: skipCount }, { $limit: perPage }],
          },
        },
        {
          $project: {
            total: { $arrayElemAt: ['$totalCount.count', 0] },
            videos: '$paginatedResults',
          },
        },
      ];

      const result = await MongoAICaptionRequestModel.aggregate(pipeline).exec();

      return {
        total: result[0]?.total || 0,
        videos: result[0]?.videos || [],
      };
    } catch (error) {
      logger.error('Error retrieving user AI description requests:', error);
      throw new HttpException(500, 'Internal server error');
    }
  }

  // Add these methods to your UserService class

  public async saveVisitedVideosHistory(user_id: string, youtube_id: string) {
    try {
      if (!user_id || !youtube_id) {
        throw new HttpException(400, 'Missing required parameters');
      }

      const userHistory = await MongoHistoryModel.findOne({ user: user_id });

      if (userHistory) {
        // Remove any existing entry of this video
        const filteredVideos = userHistory.visited_videos.filter(video => video.youtube_id !== youtube_id);

        // Add new entry at the beginning with proper structure
        const updatedVideos = [
          {
            youtube_id: youtube_id,
            visited_at: new Date(),
          },
          ...filteredVideos,
        ];

        // Update the document with valid data
        await MongoHistoryModel.findOneAndUpdate(
          { user: user_id },
          {
            $set: { visited_videos: updatedVideos },
          },
          { new: true },
        );

        return { success: true, visited_videos: updatedVideos };
      } else {
        // Create new history document
        const newHistory = await MongoHistoryModel.create({
          user: user_id,
          visited_videos: [
            {
              youtube_id: youtube_id,
              visited_at: new Date(),
            },
          ],
        });

        return { success: true, visited_videos: newHistory.visited_videos };
      }
    } catch (error) {
      logger.error('Error saving video history:', error);
      throw error;
    }
  }

  public async getVisitedVideosHistory(user_id: string, pageNumber: string, paginate = true) {
    try {
      if (!user_id) {
        throw new HttpException(400, 'User ID is required');
      }

      const page = parseInt(pageNumber, 10);
      const perPage = 4;
      const skipCount = Math.max((page - 1) * perPage, 0);

      // Find the user's history and get only the required page of videos
      const userHistory = await MongoHistoryModel.findOne({ user: user_id }).select('visited_videos').slice('visited_videos', [skipCount, perPage]).lean();

      if (!userHistory || !userHistory.visited_videos) {
        return { videos: [], total: 0 };
      }

      // Get total count separately
      const totalCount = await MongoHistoryModel.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(user_id) } },
        { $project: { count: { $size: '$visited_videos' } } },
      ]);

      const total = totalCount[0]?.count || 0;

      // Process videos in parallel
      const enrichedVideos = await Promise.all(
        userHistory.visited_videos.map(async entry => {
          try {
            // First try to get from our DB
            let videoData = await MongoVideosModel.findOne({ youtube_id: entry.youtube_id })
              .select('_id youtube_id title duration created_at updated_at')
              .lean();

            // If not in our DB, get from YouTube and save to DB
            if (!videoData) {
              try {
                const ytVideoData = await getYouTubeVideoStatus(entry.youtube_id);
                if (!ytVideoData) {
                  throw new Error('Video not found on YouTube');
                }

                // Save to our database first
                const newVideo = new MongoVideosModel({
                  youtube_id: ytVideoData.youtube_id,
                  title: ytVideoData.title,
                  duration: ytVideoData.duration,
                  created_at: ytVideoData.created_at || Date.now(),
                  updated_at: ytVideoData.updated_at || Date.now(),
                });

                const savedVideo = await newVideo.save();
                videoData = savedVideo.toObject(); // Convert to plain object
              } catch (ytError) {
                logger.error(`Error fetching YouTube video ${entry.youtube_id}:`, ytError);
                // Remove invalid video from history
                await MongoHistoryModel.updateOne({ user: user_id }, { $pull: { visited_videos: { youtube_id: entry.youtube_id } } });
                return null;
              }
            }

            // Get audio description data
            const audioDescription = await MongoAudio_Descriptions_Model.findOne({ video: videoData._id })
              .select('_id status overall_rating_votes_average overall_rating_votes_counter overall_rating_votes_sum')
              .lean();

            return {
              video_id: videoData._id,
              youtube_video_id: videoData.youtube_id,
              video_name: videoData.title,
              video_length: videoData.duration,
              visited_at: entry.visited_at,
              createdAt: videoData.created_at,
              updatedAt: videoData.updated_at,
              audio_description_id: audioDescription?._id || null,
              status: audioDescription?.status || null,
              overall_rating_votes_average: audioDescription?.overall_rating_votes_average || null,
              overall_rating_votes_counter: audioDescription?.overall_rating_votes_counter || null,
              overall_rating_votes_sum: audioDescription?.overall_rating_votes_sum || null,
            };
          } catch (error) {
            logger.error(`Error processing video ${entry.youtube_id}:`, error);
            // Remove invalid video from history
            await MongoHistoryModel.updateOne({ user: user_id }, { $pull: { visited_videos: { youtube_id: entry.youtube_id } } });
            return null;
          }
        }),
      );

      // Filter out null entries (failed videos)
      const validVideos = enrichedVideos.filter((video): video is NonNullable<typeof video> => video !== null);

      return {
        videos: validVideos,
        total: Math.max(0, total - (enrichedVideos.length - validVideos.length)),
      };
    } catch (error) {
      logger.error('Error fetching video history:', error);
      throw error;
    }
  }
}

export default UserService;
