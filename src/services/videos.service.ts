import { HttpException } from '../exceptions/HttpException';
import { convertISO8601ToSeconds, getYouTubeVideoStatus, isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import {
  PostGres_Audio_Clips,
  PostGres_Audio_Descriptions,
  PostGres_Notes,
  PostGres_Users,
  PostGres_Videos,
  UsersAttributes,
  VideosAttributes,
} from '../models/postgres/init-models';
import {
  MongoAudio_Descriptions_Model,
  MongoAudioClipsModel,
  MongoAudioDescriptionRatingModel,
  MongoNotesModel,
  MongoUsersModel,
  MongoVideosModel,
} from '../models/mongodb/init-models.mongo';
import { IVideo } from '../models/mongodb/Videos.mongo';
import { logger } from '../utils/logger';
import { getVideoDataByYoutubeId } from './videos.util';
import cache from 'memory-cache';
import moment from 'moment';
import axios from 'axios';
import App from '../app';
import stringSimilarity from 'string-similarity';

class VideosService {
  public async getVideobyYoutubeId(youtubeId: string): Promise<any> {
    if (isEmpty(youtubeId)) throw new HttpException(400, 'youtubeId is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findVideoById = await MongoVideosModel.findOne({
        youtube_id: youtubeId,
      });
      if (!findVideoById) throw new HttpException(409, "YouTube Video doesn't exist");

      const fieldsToCheck = ['title', 'duration', 'created_at', 'updated_at'];
      const nullFields = fieldsToCheck.filter(field => !findVideoById[field]);
      if (nullFields.length > 0) {
        const updatedData = await getVideoDataByYoutubeId(youtubeId);
        const update = await MongoVideosModel.findOneAndUpdate({ youtube_id: youtubeId }, { $set: updatedData }, { new: true });
        return {
          video_id: update._id,
          youtube_video_id: update.youtube_id,
          video_name: update.title,
          video_length: update.duration,
          createdAt: update.created_at,
          updatedAt: update.updated_at,
        };
      } else {
        return {
          video_id: findVideoById._id,
          youtube_video_id: findVideoById.youtube_id,
          video_name: findVideoById.title,
          video_length: findVideoById.duration,
          createdAt: findVideoById.created_at,
          updatedAt: findVideoById.updated_at,
        };
      }
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
      // console.log(videoById);
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
      // console.log(`audioClipsData: ${audioClipsData}`);
      if (!audioClipsData) throw new HttpException(409, "Audio Clip doesn't exist");

      const notesData = await MongoNotesModel.findOne({
        where: { audio_description: audioDescriptions._id },
      });
      // console.log(`notesData: ${notesData}`);
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
      return videos.map(video => {
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
    } else {
      // Implementation in Postgres
      const audioDescriptions = await PostGres_Audio_Descriptions.findAll({ where: { UserUserId: userId } });
      if (!audioDescriptions) throw new HttpException(409, "Audio Description doesn't exist");
      const videoIds = audioDescriptions.map(ad => ad.VideoVideoId);
      const videos = await PostGres_Videos.findAll({ where: { video_id: videoIds } });
      // Merge Audio Descriptions and Videos
      return videos.map(video => {
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
    }
  }

  public async getVideoById(video_id: string) {
    console.log('Getting videos for ' + video_id);
    if (!video_id) throw new HttpException(400, 'video_id is empty');
    const video = await MongoVideosModel.findOne({ youtube_id: video_id }).populate({
      path: 'audio_descriptions',
      match: { status: 'published' }, // Filter published descriptions
      populate: [
        { path: 'audio_clips' },
        { path: 'user' }, // Populate user data for each audio description
      ],
    });
    if (!video) {
      const newVideo = await getYouTubeVideoStatus(video_id);
      return { result: newVideo };
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

  public async getSearchVideos(page?: string, query?: string) {
    try {
      console.log('INSIDE SEARCH VIDEOS');
      console.log(`page - ${page} , query - ${query}`);

      const pgNumber = Number(page);
      const searchPage = Number.isNaN(pgNumber) || pgNumber === 0 ? 50 : pgNumber * 50;
      console.log(`searchPage - ${searchPage}`);

      let matchQuery: any = {};
      let similarUserIds: string[] = [];

      if (query) {
        matchQuery = {
          $or: [
            { 'language.name': { $regex: query, $options: 'i' } },
            { youtube_id: { $regex: query, $options: 'i' } },
            { category: { $regex: query, $options: 'i' } },
            { title: { $regex: query, $options: 'i' } },
            {
              tags: {
                $elemMatch: { $regex: query, $options: 'i' },
              },
            },
            {
              custom_tags: {
                $elemMatch: { $regex: query, $options: 'i' },
              },
            },
          ],
        };

        const allUsers = await MongoUsersModel.find({ name: { $exists: true } }, 'name');
        const usernames = allUsers.map(user => user.name);

        const matches = stringSimilarity.findBestMatch(query, usernames);

        similarUserIds = matches.ratings.filter(({ rating }) => rating > 0.5).map(({ target }) => allUsers.find(user => user.name === target)._id);
        console.log('similarIDs ', similarUserIds);
        if (similarUserIds.length > 0) {
          matchQuery.$or.push({ 'populated_audio_descriptions.user._id': similarUserIds });
        }
      }

      console.log('query:', matchQuery);

      if (Object.keys(matchQuery).length === 0) {
        return [];
      }

      const videos = await MongoVideosModel.aggregate([
        {
          $lookup: {
            from: 'audio_descriptions',
            localField: 'audio_descriptions',
            foreignField: '_id',
            as: 'populated_audio_descriptions',
          },
        },
        {
          $unwind: '$populated_audio_descriptions',
        },
        {
          $lookup: {
            from: 'audio_clips',
            localField: 'populated_audio_descriptions.audio_clips',
            foreignField: '_id',
            as: 'populated_audio_descriptions.audio_clips',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'populated_audio_descriptions.user',
            foreignField: '_id',
            as: 'populated_audio_descriptions.user',
          },
        },
        {
          $unwind: '$populated_audio_descriptions.user',
        },
        {
          $match: {
            ...matchQuery,
            'populated_audio_descriptions.status': 'published',
            'populated_audio_descriptions.user._id': { $in: similarUserIds },
          },
        },
        {
          $sort: { 'populated_audio_descriptions.updated_at': -1 },
        },
        {
          $skip: searchPage - 50,
        },
        {
          $limit: 50,
        },
        {
          $project: {
            audio_descriptions: '$populated_audio_descriptions',
            category: 1,
            category_id: 1,
            created_at: 1,
            custom_tags: 1,
            description: 1,
            duration: 1,
            tags: 1,
            title: 1,
            updated_at: 1,
            views: 1,
            youtube_id: 1,
            youtube_status: 1,
            __v: 1,
            _id: 1,
          },
        },
      ]).exec();

      return videos;
    } catch (err) {
      console.log(err);
      throw new Error('Error fetching videos: ' + err);
    }
  }

  public async getAllVideos(page?: string, query?: string) {
    try {
      console.log('page', page);

      const pgNumber = Number(page);
      const searchPage = Number.isNaN(pgNumber) || pgNumber === 0 ? 50 : pgNumber * 50;

      const matchQuery = query
        ? {
            $or: [
              { 'language.name': { $regex: query, $options: 'i' } },
              { youtube_id: { $regex: query, $options: 'i' } },
              { category: { $regex: query, $options: 'i' } },
              { title: { $regex: query, $options: 'i' } },
              {
                tags: {
                  $elemMatch: { $regex: query, $options: 'i' },
                },
              },
              {
                custom_tags: {
                  $elemMatch: { $regex: query, $options: 'i' },
                },
              },
            ],
          }
        : {};

      const videos = await MongoVideosModel.aggregate([
        {
          $lookup: {
            from: 'audio_descriptions',
            localField: 'audio_descriptions',
            foreignField: '_id',
            as: 'populated_audio_descriptions',
          },
        },
        {
          $unwind: '$populated_audio_descriptions',
        },
        {
          $lookup: {
            from: 'audio_clips',
            localField: 'populated_audio_descriptions.audio_clips',
            foreignField: '_id',
            as: 'populated_audio_descriptions.audio_clips',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'populated_audio_descriptions.user',
            foreignField: '_id',
            as: 'populated_audio_descriptions.user',
          },
        },
        {
          $match: {
            ...matchQuery,
            'populated_audio_descriptions.status': 'published',
          },
        },
        {
          $sort: { 'populated_audio_descriptions.updated_at': -1 },
        },
        {
          $skip: searchPage - 50,
        },
        {
          $limit: 50,
        },
        {
          $project: {
            audio_descriptions: '$populated_audio_descriptions',
            category: 1,
            category_id: 1,
            created_at: 1,
            custom_tags: 1,
            description: 1,
            duration: 1,
            tags: 1,
            title: 1,
            updated_at: 1,
            views: 1,
            youtube_id: 1,
            youtube_status: 1,
            __v: 1,
            _id: 1,
          },
        },
      ]).exec();

      return videos;
    } catch (err) {
      throw new Error('Error fetching videos: ' + err);
    }
  }

  public async processYouTubeVideos(): Promise<void> {
    const midnight = '00:00:00';
    let now: string | null = null;

    setInterval(async () => {
      now = moment().format('H:mm:ss');
      if (now === midnight) {
        const youTubeApiKey = `${process.env.YOUTUBE_API_KEY}`; // Replace with your actual YouTube API key

        try {
          const videos = await MongoVideosModel.find({
            $or: [{ youtube_status: '' }, { youtube_status: { $exists: false } }],
          })
            .limit(1000)
            .exec();

          for (const video of videos) {
            const videoDetails = await this.getYouTubeVideoDetails(video.youtube_id, youTubeApiKey);

            if (videoDetails) {
              const { duration, tags, categoryId } = videoDetails;
              const category = await this.getYouTubeCategory(categoryId, youTubeApiKey);

              const toUpdate = {
                tags: tags,
                category_id: categoryId,
                category: category,
                duration: duration,
                youtube_status: 'available',
              };

              const updatedVideo = await MongoVideosModel.findOneAndUpdate({ youtube_id: video.youtube_id }, { $set: toUpdate }, { new: true }).exec();

              // console.log(updatedVideo?.youtube_id + '; available');
            } else {
              const toUpdate = {
                youtube_status: 'unavailable',
              };

              const updatedVideo = await MongoVideosModel.findOneAndUpdate({ youtube_id: video.youtube_id }, { $set: toUpdate }, { new: true }).exec();

              // console.log(updatedVideo?.youtube_id + '; unavailable');
            }
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
          }
        } catch (error) {
          console.error('Error:', error);
        }
      }
    }, 1000);
  }

  private async getYouTubeVideoDetails(videoId: string, apiKey: string): Promise<{ duration: number; tags: string[]; categoryId: string } | null> {
    try {
      const response = await axios.get(`${process.env.YOUTUBE_API_URL}/videos`, {
        params: {
          id: videoId,
          part: 'contentDetails,snippet,statistics',
          forUsername: 'iamOTHER',
          key: apiKey,
        },
      });

      const data = response.data;

      if (data.items.length > 0) {
        const duration = convertISO8601ToSeconds(data.items[0].contentDetails.duration);
        const tags = data.items[0].snippet.tags || [];
        const categoryId = data.items[0].snippet.categoryId;

        return { duration, tags, categoryId };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error in getYouTubeVideoDetails:', error);
      return null;
    }
  }

  private async getYouTubeCategory(categoryId: string, apiKey: string) {
    try {
      const response = await axios.get(`${process.env.YOUTUBE_API_URL}/videoCategories`, {
        params: {
          id: categoryId,
          part: 'snippet',
          forUsername: 'iamOTHER',
          key: apiKey,
        },
      });

      return response.data.items.map((item: any) => item.snippet.title).join(',');
    } catch (error) {
      console.error('Error in getYouTubeCategory:', error);
      return '';
    }
  }

  public async getYoutubeDataFromCache(youtubeIds: string, key: string) {
    const youtubeIdsCacheKey = key + 'YoutubeIds';
    const youtubeDataCacheKey = key + 'YoutubeData';

    if (youtubeIds === cache.get(youtubeIdsCacheKey)) {
      // console.log(`loading ${key} from cache`);
      const ret = { status: 200, result: undefined };
      ret.result = cache.get(youtubeDataCacheKey);
      return ret;
    } else {
      cache.put(youtubeIdsCacheKey, youtubeIds);

      try {
        const response = await axios.get(
          `${process.env.YOUTUBE_API_URL}/videos?id=${youtubeIds}&part=contentDetails,snippet,statistics&key=${process.env.YOUTUBE_API_KEY}`,
        );

        // console.log(`loading ${key} from youtube`);
        App.numOfVideosFromYoutube += youtubeIds.split(',').length;
        cache.put(youtubeDataCacheKey, response.data);
        const ret = { status: 200, result: undefined };
        ret.result = response.data;
        return ret;
      } catch (error) {
        console.error('Error fetching data from YouTube API:', error.message);
        throw error;
      }
    }
  }
  public async startMidnightVideoProcessing(): Promise<void> {
    const now = moment();
    const midnight = moment().startOf('day');

    const timeUntilMidnight = midnight.diff(now);

    setTimeout(() => {
      this.processYouTubeVideos();
      setInterval(() => {
        this.processYouTubeVideos();
      }, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
  }
}

export default VideosService;
