import { Queue, Worker, Job } from 'bullmq';
import { redis } from '@/lib/utils/redis';

// Job queues
export const ingestionQueue = redis
  ? new Queue('ingestion', { connection: redis })
  : null;

export const scoringQueue = redis
  ? new Queue('scoring', { connection: redis })
  : null;

export const deduplicationQueue = redis
  ? new Queue('deduplication', { connection: redis })
  : null;

// Job types
export interface IngestionJobData {
  platform: 'youtube' | 'reddit';
  timestamp: string;
}

export interface ScoringJobData {
  window: 'now' | '24h' | '7d';
  timestamp: string;
}

export interface DeduplicationJobData {
  hoursBack: number;
  timestamp: string;
}

/**
 * Add ingestion job to queue
 */
export async function scheduleIngestion(
  platform: 'youtube' | 'reddit'
): Promise<void> {
  if (!ingestionQueue) {
    console.warn('Redis not configured, skipping job scheduling');
    return;
  }

  await ingestionQueue.add(
    `ingest-${platform}`,
    {
      platform,
      timestamp: new Date().toISOString(),
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

/**
 * Add scoring job to queue
 */
export async function scheduleScoring(
  window: 'now' | '24h' | '7d'
): Promise<void> {
  if (!scoringQueue) {
    console.warn('Redis not configured, skipping job scheduling');
    return;
  }

  await scoringQueue.add(
    `score-${window}`,
    {
      window,
      timestamp: new Date().toISOString(),
    },
    {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    }
  );
}

/**
 * Add deduplication job to queue
 */
export async function scheduleDeduplication(
  hoursBack: number = 24
): Promise<void> {
  if (!deduplicationQueue) {
    console.warn('Redis not configured, skipping job scheduling');
    return;
  }

  await deduplicationQueue.add(
    'deduplicate',
    {
      hoursBack,
      timestamp: new Date().toISOString(),
    },
    {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    }
  );
}
