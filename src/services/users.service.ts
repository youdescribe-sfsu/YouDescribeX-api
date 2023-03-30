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
        user_type: 'volunteer',
        admin_level: 0,
        email: userData.email,
        alias: userData.name,
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

  public async createNewUserAudioDescription(newUserAudioDescription: CreateUserAudioDescriptionDto) {
    const { aiUserId, userId, youtubeVideoId } = newUserAudioDescription;
    if (isEmpty(aiUserId)) throw new HttpException(400, 'aiUserId is empty');
    if (isEmpty(userId)) throw new HttpException(400, 'userId is empty');
    if (isEmpty(youtubeVideoId)) throw new HttpException(400, 'youtubeVideoId is empty');
    // ##TODO
    if (CURRENT_DATABASE == 'mongodb') {
      const videoIdStatus = await MongoVideosModel.findOne({
        where: { youtube_video_id: youtubeVideoId },
      });
      if (!videoIdStatus) throw new HttpException(409, "Video doesn't exist");
      const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne({
        where: { video: videoIdStatus._id, user: userId },
      });
      if (checkIfAudioDescriptionExists) throw new HttpException(409, 'Audio Description already exists');
      const checkIfAIUserExists = await MongoUsersModel.findOne({
        where: { user_id: aiUserId },
      });
      if (!checkIfAIUserExists) throw new HttpException(409, "AI User doesn't exist");
      const checkIfAIDescriptionsExists = await MongoAudio_Descriptions_Model.findOne({
        where: { video: videoIdStatus._id, user: aiUserId },
      })
        .populate('Audio_Clips')
        .exec();
      if (!checkIfAIDescriptionsExists) throw new HttpException(409, "AI Descriptions doesn't exist");
      const createNewAudioDescription = await MongoAudio_Descriptions_Model.create({
        video: videoIdStatus._id,
        user: userId,
      });
      if (!createNewAudioDescription) throw new HttpException(409, "Audio Description couldn't be created");

      const createNewAudioClips = await MongoAudioClipsModel.insertMany(
        checkIfAIDescriptionsExists.audio_clips.map((clip: IAudioClip) => {
          return {
            audio_description: clip._id,
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
            user: userId,
            video: videoIdStatus._id,
            is_recorded: false,
          };
        }),
      );
      if (!createNewAudioClips) throw new HttpException(409, "Audio Clips couldn't be created");
      createNewAudioClips.forEach(async clip => createNewAudioDescription.audio_clips.push(clip));
      createNewAudioDescription.save();
      return createNewAudioDescription._id;
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
