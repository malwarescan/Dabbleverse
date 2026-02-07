import Redis from 'ioredis';

// Lazy-load Redis client (only create when actually used, not during build)
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  // Don't connect during Next.js build
  if (typeof window === 'undefined' && !process.env.REDIS_URL) {
    return null;
  }
  
  // Only create connection once
  if (!redis && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true, // Don't connect immediately
    });
    
    // Suppress connection errors during build
    redis.on('error', (err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Redis connection warning:', err.message);
      }
    });
  }
  
  return redis;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const cached = await client.get(key);
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
  const client = getRedisClient();
  if (!client) return;

  try {
    const serialized = JSON.stringify(value);
    if (options.ttl) {
      await client.setex(key, options.ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    console.error('Redis invalidate error:', error);
  }
}

// Export both the getter function and connection config
export { getRedisClient };

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
