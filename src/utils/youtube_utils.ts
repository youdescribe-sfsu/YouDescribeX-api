import { GOOGLE_SERVICES, getCurrentYouTubeApiKey } from './google-services.config';
import axios from 'axios';
import { logger } from './logger';

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

export default YouTubeUtils;
export const { apiUrl: youTubeApiUrl, apiKey: youTubeApiKey } = {
  apiUrl: GOOGLE_SERVICES.YOUTUBE.API_URL,
  apiKey: getCurrentYouTubeApiKey(),
};
