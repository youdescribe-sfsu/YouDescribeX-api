import { CreateUserAudioDescriptionDto, CreateUserDto } from '../dtos/users.dto';
import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import { PostGres_Users, UsersAttributes } from '../models/postgres/init-models';
import { PostGres_Videos } from '../models/postgres/init-models';
import { PostGres_Audio_Descriptions } from '../models/postgres/init-models';
import { PostGres_Audio_Clips } from '../models/postgres/init-models';
import { MongoAudioClipsModel, MongoAudio_Descriptions_Model, MongoUsersModel, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { IUser } from '../models/mongodb/User.mongo';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import { logger } from '../utils/logger';
import { getVideoDataByYoutubeId } from './videos.util';
class UserService {
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
    const { youtubeVideoId } = newUserAudioDescription;
    if (isEmpty(expressUser)) throw new HttpException(403, 'User not logged in');
    if (isEmpty(youtubeVideoId)) throw new HttpException(400, 'youtubeVideoId is empty');

    const user: IUser = expressUser as IUser;

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
      if (checkIfAudioDescriptionExists) throw new HttpException(409, 'User already has an Audio Description for this video');

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

      if (aiAudioDescriptions.length <= 0) {
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
      // Check if Video exists
      const videoIdStatus = await PostGres_Videos.findOne({
        where: { youtube_video_id: youtubeVideoId },
      });
      if (!videoIdStatus) throw new HttpException(409, "Video doesn't exist");

      // Check if AUDIO DESCRIPTION already exists
      const checkIfAudioDescriptionExists = await PostGres_Audio_Descriptions.findOne({
        where: { VideoVideoId: videoIdStatus.video_id, UserUserId: userId },
      });
      if (checkIfAudioDescriptionExists) throw new HttpException(409, 'Audio Description already exists');

      // Check if AI USER exists
      const checkIfAIUserExists = await PostGres_Users.findOne({
        where: { user_id: aiUserId },
      });
      if (!checkIfAIUserExists) throw new HttpException(409, "AI User doesn't exist");

      // Check if AI Descriptions exists
      const checkIfAIDescriptionsExists = await PostGres_Audio_Descriptions.findOne({
        where: { VideoVideoId: videoIdStatus.video_id, UserUserId: aiUserId },
        include: [
          {
            model: PostGres_Audio_Clips,
            separate: true,
            order: ['clip_start_time'],
            as: 'Audio_Clips',
          },
        ],
      });
      if (!checkIfAIDescriptionsExists) throw new HttpException(409, "AI Descriptions doesn't exist");
      // Create new Audio Description
      const createNewAudioDescription = await PostGres_Audio_Descriptions.create({
        VideoVideoId: videoIdStatus.video_id,
        UserUserId: userId,
        is_published: false,
      });
      if (!createNewAudioDescription) throw new HttpException(409, "Audio Description couldn't be created");
      // Create new Audio Clips
      const createNewAudioClips = await PostGres_Audio_Clips.bulkCreate(
        checkIfAIDescriptionsExists.Audio_Clips.map(clip => {
          return {
            clip_title: clip.clip_title,
            description_type: clip.description_type,
            description_text: clip.description_text,
            playback_type: clip.playback_type,
            clip_start_time: clip.clip_start_time,
            is_recorded: false,
          };
        }),
      );
      if (!createNewAudioClips) throw new HttpException(409, "Audio Clips couldn't be created");
      createNewAudioClips.forEach(async clip => {
        createNewAudioDescription.addAudio_Clip(clip);
      });
      return {
        audioDescriptionId: createNewAudioDescription.ad_id,
        fromAI: true,
      };
    }
  }
}

export default UserService;
