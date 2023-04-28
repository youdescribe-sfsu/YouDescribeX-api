import { HttpException } from '../exceptions/HttpException';
import { convertISO8601ToSeconds, isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import { MongoWishListModel, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { YOUTUBE_API_KEY, YOUTUBE_API_URL } from '../config';
import axios from 'axios';
import { logger } from '../utils/logger';

interface GetVideoDataByYoutubeIdResponse {
  youtube_id: string;
  title: string;
  description: string;
  category: string;
  category_id: number;
  duration: number;
  tags: string[];
}

export const getVideoDataByYoutubeId = async (youtubeId: string): Promise<GetVideoDataByYoutubeIdResponse> => {
  if (isEmpty(youtubeId)) throw new HttpException(400, 'youtubeId is empty');

  if (CURRENT_DATABASE == 'mongodb') {
    // Need to get from YouTube all of the necessary Video data
    try {
      const youtubeVideoResponse = await axios.get(
        `${YOUTUBE_API_URL}/videos?id=${youtubeId}&part=contentDetails,snippet,statistics&forUsername=iamOTHER&key=${YOUTUBE_API_KEY}`,
      );

      if (youtubeVideoResponse.data.items.length <= 0) {
        throw new HttpException(500, `Could not get Youtube Video Data for ${youtubeId}`);
      }

      const youtubeVideoData = youtubeVideoResponse.data.items[0];
      const title = youtubeVideoData.snippet.title;
      const description = youtubeVideoData.snippet.description;
      const category_id = youtubeVideoData.snippet.categoryId;
      const duration = convertISO8601ToSeconds(youtubeVideoData.contentDetails.duration);
      const tags = youtubeVideoData.snippet.tags;

      const youtubeVideoCategoryResponse = await axios
        .get(`${YOUTUBE_API_URL}/videoCategories?id=${category_id}&part=snippet&forUsername=iamOTHER&key=${YOUTUBE_API_KEY}`)
        .catch(err => {
          logger.error(err);
          throw new HttpException(400, 'youtube video status is unavailable');
        });

      const youtubeVideoCategoryJson = youtubeVideoCategoryResponse.data;
      let category = '';
      for (let i = 0; i < youtubeVideoCategoryJson.items.length; ++i) {
        if (i > 0) {
          category += ',';
        }
        category += youtubeVideoCategoryJson.items[i].snippet.title;
      }

      const return_val = {
        youtube_id: youtubeId,
        title: title,
        description: description,
        category: category,
        category_id: category_id,
        duration: duration,
        tags: tags,
      };

      return return_val;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  } else {
    throw new HttpException(500, 'Not implemented error.');
  }
};
