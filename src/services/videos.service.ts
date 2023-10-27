import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import { PostGres_Notes, PostGres_Users, UsersAttributes, VideosAttributes } from '../models/postgres/init-models';
import { PostGres_Videos } from '../models/postgres/init-models';
import { PostGres_Audio_Descriptions } from '../models/postgres/init-models';
import { PostGres_Audio_Clips } from '../models/postgres/init-models';
import {
  MongoAudioClipsModel,
  MongoAudioDescriptionRatingModel,
  MongoAudio_Descriptions_Model,
  MongoNotesModel,
  MongoUsersModel,
  MongoVideosModel,
} from '../models/mongodb/init-models.mongo';
import { IVideo } from '../models/mongodb/Videos.mongo';
import { logger } from '../utils/logger';
import { getVideoDataByYoutubeId } from './videos.util';
class VideosService {
  public async getVideobyYoutubeId(youtubeId: string): Promise<IVideo | VideosAttributes> {
    if (isEmpty(youtubeId)) throw new HttpException(400, 'youtubeId is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findVideoById = await MongoVideosModel.findOne({
        youtube_id: youtubeId,
      });
      if (!findVideoById) throw new HttpException(409, "YouTube Video doesn't exist");
      const return_val = {
        video_id: findVideoById._id,
        youtube_video_id: findVideoById.youtube_id,
        video_name: findVideoById.title,
        video_length: findVideoById.duration,
        createdAt: findVideoById.created_at,
        updatedAt: findVideoById.updated_at,
      };
      return return_val;
    } else {
      const findVideoById: VideosAttributes = await PostGres_Videos.findOne({
        where: { youtube_video_id: youtubeId },
      });
      if (!findVideoById) throw new HttpException(409, "YouTube Video doesn't exist");
      return findVideoById;
    }
  }

  public async deleteVideoForUser(youtubeId: string, userId: string): Promise<IVideo | VideosAttributes> {
    if (isEmpty(youtubeId)) throw new HttpException(400, 'youtubeId is empty');
    if (isEmpty(userId)) throw new HttpException(400, 'userId is empty');
    if (CURRENT_DATABASE == 'mongodb') {
      const videoById = await MongoVideosModel.findOne({
        youtube_id: youtubeId,
      });
      console.log(videoById);
      if (!videoById) throw new HttpException(409, "Video doesn't exist");

      const userById: UsersAttributes = await MongoUsersModel.findById(userId);
      if (!userById) throw new HttpException(409, "User doesn't exist");

      const audioDescriptions = await MongoAudio_Descriptions_Model.findOne({
        where: { user: userId, video: videoById._id },
      });
      if (!audioDescriptions) throw new HttpException(409, "Audio Description doesn't exist");

      const response = await MongoAudio_Descriptions_Model.deleteOne({ _id: audioDescriptions._id });
      console.log(`response: ${JSON.stringify(response)}`);

      const audioClipsData = await MongoAudioClipsModel.findOne({
        where: { audio_description: audioDescriptions._id },
      });
      console.log(`audioClipsData: ${audioClipsData}`);
      if (!audioClipsData) throw new HttpException(409, "Audio Clip doesn't exist");

      const notesData = await MongoNotesModel.findOne({
        where: { audio_description: audioDescriptions._id },
      });
      console.log(`notesData: ${notesData}`);
      if (notesData)
        await MongoNotesModel.deleteMany({
          where: { audio_description: audioDescriptions._id },
        });
      await MongoAudioClipsModel.deleteMany({
        where: { audio_description: audioDescriptions._id, user: userId, video: videoById._id },
      });
      await MongoAudio_Descriptions_Model.deleteOne({
        where: { ad_id: audioDescriptions._id, user: userId },
      });
      await MongoVideosModel.deleteOne({
        where: { youtube_id: videoById._id },
      });
      return videoById;
    } else {
      const videoById: VideosAttributes = await PostGres_Videos.findOne({
        where: { youtube_video_id: youtubeId },
      });
      if (!videoById) throw new HttpException(409, "Video doesn't exist");

      const userById: UsersAttributes = await PostGres_Users.findOne({
        where: { user_id: userId },
      });
      if (!userById) throw new HttpException(409, "User doesn't exist");

      const audioDescriptions = await PostGres_Audio_Descriptions.findOne({
        where: { UserUserId: userId, VideoVideoId: videoById.video_id },
      });
      if (!audioDescriptions) throw new HttpException(409, "Audio Description doesn't exist");

      const audioClipsData = await PostGres_Audio_Clips.findOne({
        where: { AudioDescriptionAdId: audioDescriptions.ad_id },
      });
      if (!audioClipsData) throw new HttpException(409, "Audio Clip doesn't exist");

      const notesData = await PostGres_Notes.findOne({
        where: { AudioDescriptionAdId: audioDescriptions.ad_id },
      });
      if (notesData)
        await PostGres_Notes.destroy({
          where: { AudioDescriptionAdId: audioDescriptions.ad_id },
        });
      await PostGres_Audio_Clips.destroy({
        where: { AudioDescriptionAdId: audioDescriptions.ad_id },
      });
      await PostGres_Audio_Descriptions.destroy({
        where: { UserUserId: userId, VideoVideoId: videoById.video_id },
      });
      return videoById;
    }
  }

  public async getVideosForUserId(userId: string): Promise<IVideo[] | VideosAttributes[]> {
    if (!userId) throw new HttpException(400, 'userId is empty');
    if (CURRENT_DATABASE == 'mongodb') {
      logger.info(`Retrieving audio descriptions for ${userId}`);
      const audioDescriptions = await MongoAudio_Descriptions_Model.find({ user: userId });
      if (!audioDescriptions) throw new HttpException(409, "Audio Description doesn't exist");

      logger.info(`Finding videos for ${audioDescriptions.length} accompanying audio descriptions: ${audioDescriptions.map(ad => ad.video)}`);

      const videoIds = audioDescriptions.map(ad => ad.video);

      const videos = await MongoVideosModel.find({ _id: { $in: videoIds } });

      logger.info(`Found videos: ${videos.map(video => video.youtube_id)}`);

      // Merge Audio Descriptions and Videos
      const return_val = videos.map(video => {
        const audioDescription = audioDescriptions.find(ad => ad.video == `${video._id}`);

        return {
          video_id: video._id,
          youtube_video_id: video.youtube_id,
          video_name: video.title,
          video_length: video.duration,
          createdAt: video.created_at,
          updatedAt: video.updated_at,
          audio_description_id: audioDescription._id,
          status: audioDescription.status,
          overall_rating_votes_average: audioDescription.overall_rating_votes_average,
          overall_rating_votes_counter: audioDescription.overall_rating_votes_counter,
          overall_rating_votes_sum: audioDescription.overall_rating_votes_sum,
        };
      });
      return return_val;
    } else {
      // Implementation in Postgres
      const audioDescriptions = await PostGres_Audio_Descriptions.findAll({ where: { UserUserId: userId } });
      if (!audioDescriptions) throw new HttpException(409, "Audio Description doesn't exist");
      const videoIds = audioDescriptions.map(ad => ad.VideoVideoId);
      const videos = await PostGres_Videos.findAll({ where: { video_id: videoIds } });
      // Merge Audio Descriptions and Videos
      const return_val = videos.map(video => {
        const audioDescription = audioDescriptions.find(ad => ad.VideoVideoId == video.video_id);
        return {
          video_id: video.video_id,
          youtube_video_id: video.youtube_video_id,
          video_name: video.video_name,
          video_length: video.video_length,
          createdAt: video.createdAt,
          updatedAt: video.updatedAt,
          audio_description_id: audioDescription.ad_id,
        };
      });
      return return_val;
    }
  }

  public async getVideoById(video_id: string) {
    if (!video_id) throw new HttpException(400, 'video_id is empty');
    const video = await MongoVideosModel.findOne({ youtube_id: video_id }).populate({
      path: 'audio_descriptions',
      populate: {
        path: 'audio_clips',
      },
    });

    if (!video) {
      return { result: null };
    }

    const newVideo = video.toJSON();

    const audioDescriptions = newVideo.audio_descriptions.slice();
    newVideo.audio_descriptions = [];

    async function processAudioDescription(ad) {
      const audioDescriptionRating = await MongoAudioDescriptionRatingModel.find({
        audio_description_id: ad._id,
      }).exec();

      ad.feedbacks = {} as { [key: string]: number };

      if (audioDescriptionRating && audioDescriptionRating.length > 0) {
        audioDescriptionRating.forEach(adr => {
          if (adr.feedback && adr.feedback.length > 0) {
            adr.feedback.forEach(item => {
              if (!ad.feedbacks.hasOwnProperty(item)) {
                ad.feedbacks[item] = 0;
              }
              ad.feedbacks[item] += 1;
            });
          }
        });
      }

      return ad;
    }

    const audioDescriptionPromises = audioDescriptions.map(processAudioDescription);

    newVideo.audio_descriptions = await Promise.all(audioDescriptionPromises);

    return { result: newVideo };
    // } else {
    //   throw new HttpException(400, 'video not found');
    // }

    // return { result: video };
  }
}

export default VideosService;
