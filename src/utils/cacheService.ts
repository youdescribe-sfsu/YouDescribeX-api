// src/utils/cacheService.ts
import { LRUCache } from 'lru-cache';
import { logger } from './logger';

class CacheService {
  private static instance: CacheService;
  private cache: LRUCache<string, any>;

  private constructor() {
    this.cache = new LRUCache<string, any>({
      max: 500, // Maximum number of items to store
      ttl: 5 * 60 * 1000, // Default TTL: 5 minutes
      updateAgeOnGet: true, // Reset TTL when item is accessed
      allowStale: false,
      sizeCalculation: (value, key) => {
        // Rough estimation of object size
        return JSON.stringify(value).length;
      },
      maxSize: 50 * 1024 * 1024, // 50MB max cache size
    });
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
      logger.info('Cache service initialized');
    }
    return CacheService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = this.cache.get(key);
      return (value as T) || null;
    } catch (error) {
      logger.error(`Error getting item from cache with key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const options = ttl ? { ttl } : undefined;
      this.cache.set(key, value, options);
    } catch (error) {
      logger.error(`Error setting item in cache with key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.cache.delete(key);
    } catch (error) {
      logger.error(`Error deleting item from cache with key ${key}:`, error);
    }
  }

  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      let invalidatedCount = 0;
      for (const key of this.cache.keys()) {
        if (String(key).startsWith(prefix)) {
          this.cache.delete(key);
          invalidatedCount++;
        }
      }
      if (invalidatedCount > 0) {
        logger.info(`Invalidated ${invalidatedCount} cache entries with prefix ${prefix}`);
      }
    } catch (error) {
      logger.error(`Error invalidating cache with prefix ${prefix}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      this.cache.clear();
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }
}

export default CacheService.getInstance();
