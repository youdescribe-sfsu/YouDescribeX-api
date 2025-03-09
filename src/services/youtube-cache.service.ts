import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';
import axios from 'axios';
import { MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { YOUTUBE_API_KEY } from '../config';

class YouTubeCacheService {
  private memoryCache: LRUCache<string, any>;
  private static instance: YouTubeCacheService;
  private readonly YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
  private readonly API_KEY = YOUTUBE_API_KEY;

  private constructor() {
    this.memoryCache = new LRUCache<string, any>({
      max: 1000,
      ttl: 30 * 60 * 1000, // 30 minutes
      updateAgeOnGet: true,
      sizeCalculation: value => {
        return JSON.stringify(value).length;
      },
      maxSize: 100 * 1024 * 1024, // 100MB
    });

    logger.info('YouTube Cache Service initialized');
  }

  public static getInstance(): YouTubeCacheService {
    if (!YouTubeCacheService.instance) {
      YouTubeCacheService.instance = new YouTubeCacheService();
    }
    return YouTubeCacheService.instance;
  }

  async getVideoData(videoIds: string[]): Promise<any> {
    if (!videoIds.length) {
      return { items: [] };
    }

    // Create a unique cache key based on sorted video IDs
    const cacheKey = `youtube-videos-${videoIds.sort().join(',')}`;

    // First try memory cache
    const cachedData = this.memoryCache.get(cacheKey);
    if (cachedData) {
      logger.info(`YouTube cache hit for ${videoIds.length} videos`);
      return cachedData;
    }

    // Then try database cache
    const dbCachedData = await this.getFromDatabaseCache(videoIds);
    if (dbCachedData && dbCachedData.items && dbCachedData.items.length === videoIds.length) {
      logger.info(`YouTube database cache hit for ${videoIds.length} videos`);
      this.memoryCache.set(cacheKey, dbCachedData);
      return dbCachedData;
    }

    // Finally fetch from YouTube API
    try {
      logger.info(`Fetching ${videoIds.length} videos from YouTube API`);
      const fetchedData = await this.fetchFromYouTubeAPI(videoIds);

      // Store in both caches
      this.memoryCache.set(cacheKey, fetchedData);
      await this.saveToDatabase(fetchedData);

      return fetchedData;
    } catch (error) {
      logger.error(`Error fetching videos from YouTube API: ${error.message}`);
      throw error;
    }
  }

  private async getFromDatabaseCache(videoIds: string[]): Promise<any> {
    try {
      const videos = await MongoVideosModel.find({
        youtube_id: { $in: videoIds },
        youtube_metadata: { $exists: true },
      }).lean();

      if (!videos.length) {
        return null;
      }

      // Convert to YouTube API response format
      return {
        items: videos.map(video => video.youtube_metadata),
      };
    } catch (error) {
      logger.error(`Error fetching videos from database cache: ${error.message}`);
      return null;
    }
  }

  private async saveToDatabase(youtubeData: any): Promise<void> {
    if (!youtubeData.items || !youtubeData.items.length) {
      return;
    }

    try {
      const bulkOps = youtubeData.items.map(item => {
        return {
          updateOne: {
            filter: { youtube_id: item.id },
            update: {
              $set: {
                youtube_metadata: item,
                youtube_status: 'available',
                updated_at: Date.now(),
              },
            },
            upsert: true,
          },
        };
      });

      await MongoVideosModel.bulkWrite(bulkOps);
      logger.info(`Saved ${youtubeData.items.length} videos to database cache`);
    } catch (error) {
      logger.error(`Error saving videos to database cache: ${error.message}`);
    }
  }

  private async fetchFromYouTubeAPI(videoIds: string[]): Promise<any> {
    // Split into chunks of 50 (YouTube API limit)
    const chunks = this.chunkArray(videoIds, 50);
    const results = [];

    for (const chunk of chunks) {
      try {
        const response = await axios.get(`${this.YOUTUBE_API_URL}/videos`, {
          params: {
            id: chunk.join(','),
            part: 'snippet,contentDetails,statistics',
            key: this.API_KEY,
          },
        });

        if (response.data.items) {
          results.push(...response.data.items);
        }
      } catch (error) {
        logger.error(`YouTube API error: ${error.message}`);
        throw error;
      }
    }

    return { items: results };
  }

  private chunkArray(array: any[], size: number): any[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Invalidate specific cache entries
  async invalidateCache(videoIds: string[]): Promise<void> {
    // Remove from memory cache
    const cacheKey = `youtube-videos-${videoIds.sort().join(',')}`;
    this.memoryCache.delete(cacheKey);

    // Update database to invalidate cached data
    try {
      await MongoVideosModel.updateMany({ youtube_id: { $in: videoIds } }, { $unset: { youtube_metadata: '' } });
    } catch (error) {
      logger.error(`Error invalidating database cache: ${error.message}`);
    }
  }

  // Clear all caches
  async clearCache(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear database cache
    try {
      await MongoVideosModel.updateMany({ youtube_metadata: { $exists: true } }, { $unset: { youtube_metadata: '' } });
    } catch (error) {
      logger.error(`Error clearing database cache: ${error.message}`);
    }
  }
}

export default YouTubeCacheService.getInstance();
