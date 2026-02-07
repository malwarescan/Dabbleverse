import Redis from 'ioredis';

// Create Redis client
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : null;

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

export async function setCache(
  key: string,
  value: any,
  options: CacheOptions = {}
): Promise<void> {
  if (!redis) return;

  try {
    const serialized = JSON.stringify(value);
    if (options.ttl) {
      await redis.setex(key, options.ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Redis invalidate error:', error);
  }
}

export { redis };

// Export for BullMQ (requires connection config with maxRetriesPerRequest: null)
export const redisConnection = {
  host: process.env.REDIS_URL?.includes('://') 
    ? new URL(process.env.REDIS_URL).hostname 
    : 'localhost',
  port: process.env.REDIS_URL?.includes('://') 
    ? parseInt(new URL(process.env.REDIS_URL).port || '6379')
    : 6379,
  maxRetriesPerRequest: null,
};
