import { YOUTUBE_API_KEY, NODE_ENV } from '../config';
import axios from 'axios';
import { logger } from './logger';
import YouTubeCacheService from '../services/youtube-cache.service';

class YouTubeUtils {
  private static apiUrl = 'https://www.googleapis.com/youtube/v3';
  private static apiKey = YOUTUBE_API_KEY;
  private static cacheService = YouTubeCacheService;

  // Get video data with caching
  static async getVideoData(videoId: string) {
    try {
      const response = await this.cacheService.getVideoData([videoId]);

      if (!response.items?.length) {
        throw new Error(`No video found for ID: ${videoId}`);
      }

      return response.items[0];
    } catch (error) {
      logger.error('YouTube API Error:', error);
      throw error;
    }
  }

  // Get multiple videos with caching
  static async getMultipleVideos(videoIds: string[]) {
    try {
      return await this.cacheService.getVideoData(videoIds);
    } catch (error) {
      logger.error('YouTube API Error:', error);
      throw error;
    }
  }

  // Get video category with caching
  static async getVideoCategory(categoryId: string) {
    try {
      // Since categories change infrequently, cache them for longer
      const cacheKey = `category-${categoryId}`;
      let category = await this.getCachedCategory(cacheKey);

      if (!category) {
        const response = await axios.get(`${this.apiUrl}/videoCategories`, {
          params: {
            id: categoryId,
            part: 'snippet',
            key: this.apiKey,
          },
        });

        category = response.data.items[0]?.snippet.title;

        // Cache the category
        if (category) {
          await this.cacheCategory(cacheKey, category);
        }
      }

      return category;
    } catch (error) {
      logger.error('YouTube Category API Error:', error);
      throw error;
    }
  }

  // Helper methods for category caching
  private static async getCachedCategory(key: string): Promise<string | null> {
    return null; // Implement category caching as needed
  }

  private static async cacheCategory(key: string, value: string): Promise<void> {
    // Implement category caching as needed
  }
}

export default YouTubeUtils;
