import YouTubeUtils from './youtube_utils';
import { HttpException } from '../exceptions/HttpException';
import { convertISO8601ToSeconds, isEmpty } from './util';
import { logger } from './logger';

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
  if (isEmpty(youtubeId)) {
    throw new HttpException(400, 'youtubeId is empty');
  }

  try {
    const videoData = await YouTubeUtils.getVideoData(youtubeId);
    const categoryId = videoData.snippet.categoryId;
    const category = await YouTubeUtils.getVideoCategory(categoryId);

    return {
      youtube_id: youtubeId,
      title: videoData.snippet.title,
      description: videoData.snippet.description,
      category: category,
      category_id: categoryId,
      duration: convertISO8601ToSeconds(videoData.contentDetails.duration),
      tags: videoData.snippet.tags || [],
    };
  } catch (error) {
    logger.error('Video Data Fetch Error:', error);
    throw new HttpException(500, `Could not get Youtube Video Data for ${youtubeId}`);
  }
};

export const isVideoAvailable = async (youtubeId: string): Promise<boolean> => {
  if (isEmpty(youtubeId)) {
    throw new HttpException(400, 'youtubeId is empty');
  }

  try {
    await YouTubeUtils.getVideoData(youtubeId);
    return true;
  } catch (error) {
    return false;
  }
};
