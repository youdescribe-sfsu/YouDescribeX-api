import { GOOGLE_SERVICES, getCurrentYouTubeApiKey } from './google-services.config';
import axios from 'axios';
import { logger } from './logger';
import youtube_utils from './youtube_utils';

class YouTubeUtils {
  private static apiUrl = GOOGLE_SERVICES.YOUTUBE.API_URL;
  private static apiKey = getCurrentYouTubeApiKey();

  static async getVideoData(videoId: string) {
    try {
      const response = await axios.get(`${this.apiUrl}/videos?id=${videoId}&part=contentDetails,snippet,statistics&key=${this.apiKey}`);

      if (!response.data.items?.length) {
        throw new Error(`No video found for ID: ${videoId}`);
      }

      return response.data.items[0];
    } catch (error) {
      logger.error('YouTube API Error:', error);
      throw error;
    }
  }

  static async getVideoCategory(categoryId: string) {
    try {
      const response = await axios.get(`${this.apiUrl}/videoCategories?id=${categoryId}&part=snippet&key=${this.apiKey}`);
      return response.data.items[0]?.snippet.title;
    } catch (error) {
      logger.error('YouTube Category API Error:', error);
      throw error;
    }
  }
}

export const fetchVideoDetails = async (videoIds: string | string[]) => {
  const ids = Array.isArray(videoIds) ? videoIds : [videoIds];

  try {
    const responses = await Promise.allSettled(ids.map(id => youtube_utils.getVideoData(id)));

    return {
      items: responses
        .filter(result => result.status === 'fulfilled' && result.value) // Remove failed requests
        .map(result => (result as PromiseFulfilledResult<any>).value),
    };
  } catch (error) {
    console.error('Error fetching video details:', error);
    return { items: [] };
  }
};

export default YouTubeUtils;
export const { apiUrl: youTubeApiUrl, apiKey: youTubeApiKey } = {
  apiUrl: GOOGLE_SERVICES.YOUTUBE.API_URL,
  apiKey: getCurrentYouTubeApiKey(),
};
