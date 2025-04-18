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
import { getVideoDataByYoutubeId } from '../utils/videos.util';
import moment from 'moment';
import axios from 'axios';
import stringSimilarity from 'string-similarity';
import mongoose from 'mongoose';
import cacheService from '../utils/cacheService';
import YoutubeCacheService from './youtube-cache.service';

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

  public async getVideosForUserId(userId: string) {
    if (!userId) throw new HttpException(400, 'userId is empty');
    if (CURRENT_DATABASE == 'mongodb') {
      logger.info(`Retrieving audio descriptions for ${userId}`);
      const audioDescriptions = await MongoAudio_Descriptions_Model.find({ user: userId });
      if (!audioDescriptions) throw new HttpException(409, "Audio Description doesn't exist");

      logger.info(`Finding videos for ${audioDescriptions.length} accompanying audio descriptions: ${audioDescriptions.map(ad => ad.video)}`);

      const videoIds = audioDescriptions.map(ad => ad.video);

      const videos = await MongoVideosModel.find({ _id: { $in: videoIds } });

      logger.info(`Found videos: ${videos.map(video => video.youtube_id)}`);

      const return_arr = [];

      videos.map(video => {
        const audioDescription = audioDescriptions.find(ad => ad.video == `${video._id}`);

        return_arr.push({
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
        });
      });

      return {
        result: return_arr,
      };
    } else {
      // Implementation in Postgres
      const audioDescriptions = await PostGres_Audio_Descriptions.findAll({ where: { UserUserId: userId } });
      if (!audioDescriptions) throw new HttpException(409, "Audio Description doesn't exist");
      const videoIds = audioDescriptions.map(ad => ad.VideoVideoId);
      const videos = await PostGres_Videos.findAll({ where: { video_id: videoIds } });
      // Merge Audio Descriptions and Videos
      videos.map(video => {
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
    if (!video_id) {
      throw new HttpException(400, 'video_id is empty');
    }

    try {
      const video = await MongoVideosModel.findOne({ youtube_id: video_id }).populate({
        path: 'audio_descriptions',
        populate: [{ path: 'audio_clips' }, { path: 'user' }],
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

        if (ad.contributions) {
          const nameContributions = new Map<string, number>();
          for (const [key, value] of Object.entries(ad.contributions)) {
            try {
              if (!mongoose.Types.ObjectId.isValid(key)) {
                nameContributions[key] = value;
                continue;
              }

              const user = await MongoUsersModel.findOne({ _id: key });
              if (!user) {
                logger.warn(`User not found for ID: ${key}, skipping contribution mapping`);
                continue;
              }
              const name = user.user_type === 'AI' ? 'AI Description Draft' : user.name;
              nameContributions[name] = value;
            } catch (error) {
              logger.error(`Error processing contribution for key ${key}:`, error);
              continue;
            }
          }
          ad.contributions = nameContributions;
        }
        return ad;
      }

      const processedDescriptions = await Promise.all(audioDescriptions.map(processAudioDescription));

      // Sort the descriptions so AI drafts appear at the end
      newVideo.audio_descriptions = processedDescriptions.sort((a, b) => {
        // If a is an AI draft and b is not, a should come after b
        if (a.user?.user_type === 'AI' && b.user?.user_type !== 'AI') return 1;
        // If b is an AI draft and a is not, b should come after a
        if (a.user?.user_type !== 'AI' && b.user?.user_type === 'AI') return -1;
        // If both are the same type, maintain their original order
        return 0;
      });

      return { result: newVideo };
    } catch (error) {
      console.error('Error in getVideoById:', error);
      throw error;
    }
  }

  public async getSearchVideos(page = '1', query = '') {
    try {
      const pgNumber = Number(page);
      if (isNaN(pgNumber) || pgNumber < 1) {
        throw new Error('Invalid page number');
      }

      const videosPerPage = 20;
      const skipValue = (pgNumber - 1) * videosPerPage;
      const normalizedQuery = query.toLowerCase();
      const regexQuery = '\\b' + normalizedQuery + '\\b';

      const matchQuery: any = {
        $or: [
          { 'language.name': { $regex: regexQuery, $options: 'i' } },
          { category: { $regex: regexQuery, $options: 'i' } },
          { title: { $regex: regexQuery, $options: 'i' } },
          {
            tags: {
              $elemMatch: { $regex: regexQuery, $options: 'i' },
            },
          },
          {
            custom_tags: {
              $elemMatch: { $regex: regexQuery, $options: 'i' },
            },
          },
        ],
        'populated_audio_descriptions.status': 'published',
      };

      const allUsers = await MongoUsersModel.find({ name: { $exists: true } }, { _id: 1, name: 1 });
      const usernames = allUsers.map(user => user.name.toLowerCase());

      const matches = stringSimilarity.findBestMatch(normalizedQuery, usernames);

      const similarUserIds = Array.from(
        new Set(
          matches.ratings
            .filter(({ rating }) => rating > 0.5)
            .map(({ target }) => {
              const normalizedTarget = target.toLowerCase();
              return allUsers.filter(user => user.name.toLowerCase() === normalizedTarget).map(user => user._id.toString());
            })
            .flat(),
        ),
      );

      if (similarUserIds.length > 0) {
        matchQuery.$or.push({ 'populated_audio_descriptions.user._id': { $in: similarUserIds } });
      }

      if (/^[a-zA-Z0-9-_]{11}$/.test(query)) {
        matchQuery.$or.push({ youtube_id: query });
      }

      const result = await MongoVideosModel.aggregate([
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
          $match: matchQuery,
        },
        {
          $sort: { 'populated_audio_descriptions.updated_at': -1 },
        },
        {
          $group: {
            _id: '$_id',
            audio_descriptions: { $push: '$populated_audio_descriptions' },
            category: { $first: '$category' },
            category_id: { $first: '$category_id' },
            created_at: { $first: '$created_at' },
            custom_tags: { $first: '$custom_tags' },
            description: { $first: '$description' },
            duration: { $first: '$duration' },
            tags: { $first: '$tags' },
            title: { $first: '$title' },
            updated_at: { $first: '$updated_at' },
            views: { $first: '$views' },
            youtube_id: { $first: '$youtube_id' },
            youtube_status: { $first: '$youtube_status' },
            __v: { $first: '$__v' },
          },
        },
        {
          $facet: {
            totalCount: [{ $count: 'count' }],
            paginatedResults: [{ $skip: skipValue }, { $limit: videosPerPage }],
          },
        },
        {
          $project: {
            total: { $arrayElemAt: ['$totalCount.count', 0] },
            videos: '$paginatedResults',
          },
        },
      ]).exec();

      return {
        total: result[0]?.total || 0,
        videos: result[0]?.videos || [],
      };
    } catch (err) {
      console.error('Error fetching videos:', err);
      throw new Error('Error fetching videos: ' + err.message);
    }
  }

  public async getAllVideos(page?: string) {
    try {
      const pgNumber = Number(page);
      const searchPage = Number.isNaN(pgNumber) || pgNumber === 0 ? 50 : pgNumber * 50;

      return await MongoVideosModel.aggregate([
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
            'populated_audio_descriptions.status': 'published',
          },
        },
        {
          $group: {
            _id: '$_id',
            audio_descriptions: { $push: '$populated_audio_descriptions' },
            category: { $first: '$category' },
            category_id: { $first: '$category_id' },
            created_at: { $first: '$created_at' },
            custom_tags: { $first: '$custom_tags' },
            description: { $first: '$description' },
            duration: { $first: '$duration' },
            tags: { $first: '$tags' },
            title: { $first: '$title' },
            updated_at: { $first: '$updated_at' },
            views: { $first: '$views' },
            youtube_id: { $first: '$youtube_id' },
            youtube_status: { $first: '$youtube_status' },
            __v: { $first: '$__v' },
          },
        },
        {
          $addFields: {
            latest_audio_description_updated_at: {
              $max: '$audio_descriptions.updated_at',
            },
          },
        },
        {
          $sort: {
            latest_audio_description_updated_at: -1,
            updated_at: -1,
          },
        },
        {
          $project: {
            audio_descriptions: 1,
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
            latest_audio_description_updated_at: 1,
          },
        },
        {
          $skip: searchPage - 50,
        },
        {
          $limit: 50,
        },
      ])
        .allowDiskUse(true)
        .exec();
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
              await MongoVideosModel.findOneAndUpdate({ youtube_id: video.youtube_id }, { $set: toUpdate }, { new: true }).exec();
            } else {
              const toUpdate = {
                youtube_status: 'unavailable',
              };
              await MongoVideosModel.findOneAndUpdate({ youtube_id: video.youtube_id }, { $set: toUpdate }, { new: true }).exec();
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

  public async getHomePageVideos(page: string) {
    try {
      const cacheKey = `home_videos_page_${page}`;
      const cachedResult = await cacheService.get(cacheKey);

      if (cachedResult) {
        logger.info(`Cache hit for home page videos: ${cacheKey}`);
        return cachedResult;
      }

      logger.info(`Cache miss for home page videos: ${cacheKey}`);

      // Get videos for the page
      const pgNumber = Number(page);
      const videos = await this.getAllVideos(page);

      // Extract YouTube IDs for these videos
      const youtubeIds = videos.map(video => video.youtube_id).join(',');

      // Get YouTube data for these IDs
      const youtubeData = await this.getYoutubeDataFromCache(youtubeIds, `home-${page}`);

      // Create combined response
      const combinedResponse = {
        videos: videos,
        youtubeData: youtubeData.result,
      };

      // Cache the combined response (5 minute TTL)
      await cacheService.set(cacheKey, combinedResponse, 5 * 60 * 1000);

      return combinedResponse;
    } catch (error) {
      logger.error(`Error fetching home page videos: ${error}`);
      throw error;
    }
  }

  public async getYoutubeDataFromCache(youtubeIds: string, key: string) {
    try {
      const videoIdsArray = youtubeIds.split(',');
      const videoData = await YoutubeCacheService.getVideoData(videoIdsArray);

      return {
        status: 200,
        result: videoData,
      };
    } catch (error) {
      logger.error('Error fetching data from YouTube API:', error.message);
      throw error;
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
