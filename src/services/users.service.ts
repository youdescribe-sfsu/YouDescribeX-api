import { CreateUserAudioDescriptionDto, CreateUserDto } from '../dtos/users.dto';
import { HttpException } from '../exceptions/HttpException';
import { IUsers } from '../interfaces/users.interface';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
// import { MongoAudioClipsModel, MongoAudio_Descriptions_Model, MongoUsersModel, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { PostGres_Users } from '../models/postgres/init-models';
import { PostGres_Videos } from '../models/postgres/init-models';
import { PostGres_Audio_Descriptions } from '../models/postgres/init-models';
import { PostGres_Audio_Clips } from '../models/postgres/init-models';
class UserService {
  public async findAllUser(): Promise<IUsers[]> {
    // const users: IUsers[] = await MongoUsersModel.find();
    return [];
  }

  public async findUserByEmail(userEmail: string): Promise<any> {
    if (isEmpty(userEmail)) throw new HttpException(400, 'UserId is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      // const findUserByEmail: IUsers = await MongoUsersModel.findOne({
      //   user_email: userEmail,
      // });
      // if (!findUserByEmail) throw new HttpException(409, "User doesn't exist");
      // return findUserByEmail;
    } else {
      const findUserByEmail = await PostGres_Users.findOne({
        where: { user_email: userEmail },
      });
      if (!findUserByEmail) throw new HttpException(409, "User doesn't exist");
      return findUserByEmail;
    }
  }

  public async createUser(userData: CreateUserDto): Promise<any> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      // const findUser: IUsers = await MongoUsersModel.findOne({
      //   user_email: userData.email,
      // });
      // if (findUser) throw new HttpException(409, `This email ${userData.email} already exists`);
      // const createUserData = await MongoUsersModel.create({
      //   is_ai: false,
      //   name: userData.name,
      //   user_email: userData.email,
      // });
      // return createUserData;
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

  public async deleteUser(userEmail: string): Promise<any> {
    if (isEmpty(userEmail)) throw new HttpException(400, 'UserEmail is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      // const deleteUserByEmail: IUsers = await MongoUsersModel.findOneAndDelete({
      //   user_email: userEmail,
      // });
      // if (!deleteUserByEmail) throw new HttpException(409, "User doesn't exist");
      // return deleteUserByEmail;
    } else {
      const deleteUserByEmail = await PostGres_Users.findOne({
        where: { user_email: userEmail },
      });
      if (!deleteUserByEmail) throw new HttpException(409, "User doesn't exist");
      await PostGres_Users.destroy({ where: { user_email: userEmail } });
      return deleteUserByEmail;
    }
  }

  public async createNewUserAudioDescription(newUserAudioDescription: CreateUserAudioDescriptionDto) {
    const { aiUserId, userId, youtubeVideoId } = newUserAudioDescription;
    if (isEmpty(aiUserId)) throw new HttpException(400, 'aiUserId is empty');
    if (isEmpty(userId)) throw new HttpException(400, 'userId is empty');
    if (isEmpty(youtubeVideoId)) throw new HttpException(400, 'youtubeVideoId is empty');
    // ##TODO
    if (CURRENT_DATABASE == 'mongodb') {
      // const videoIdStatus = await MongoVideosModel.findOne({
      //   where: { youtube_video_id: youtubeVideoId },
      // });
      // if (!videoIdStatus) throw new HttpException(409, "Video doesn't exist");
      // const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne({
      //   where: { VideoVideoId: videoIdStatus.video_id, UserUserId: userId },
      // });
      // if (checkIfAudioDescriptionExists) throw new HttpException(409, 'Audio Description already exists');
      // const checkIfAIUserExists = await MongoUsersModel.findOne({
      //   where: { user_id: aiUserId },
      // });
      // if (!checkIfAIUserExists) throw new HttpException(409, "AI User doesn't exist");
      // const checkIfAIDescriptionsExists = await MongoAudio_Descriptions_Model.findOne({
      //   where: { VideoVideoId: videoIdStatus.video_id, UserUserId: aiUserId },
      //   include: [
      //     {
      //       model: MongoAudioClipsModel,
      //       separate: true,
      //       order: ['clip_start_time'],
      //       as: 'Audio_Clips',
      //     },
      //   ],
      // });
      // if (!checkIfAIDescriptionsExists) throw new HttpException(409, "AI Descriptions doesn't exist");
      // const createNewAudioDescription = await MongoAudio_Descriptions_Model.create({
      //   VideoVideoId: videoIdStatus.video_id,
      //   UserUserId: userId,
      //   is_published: false,
      // });
      // if (!createNewAudioDescription) throw new HttpException(409, "Audio Description couldn't be created");
      // const createNewAudioClips = await MongoAudioClipsModel.insertMany(
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
      //   createNewAudioDescription.Audio_Clips.push(clip);
      // });
      // return createNewAudioDescription.ad_id;
    } else {
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
      return createNewAudioDescription.ad_id;
    }
  }
}

export default UserService;
