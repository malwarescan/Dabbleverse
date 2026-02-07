// Load environment variables FIRST (before any other imports)
import './env';

// Import new YouTube workers
import './youtubeWorker';

// Old workers kept for compatibility (will be migrated)
import { Worker, Job } from 'bullmq';
import { redis, redisConnection } from '@/lib/utils/redis';
import { ingestYouTube } from '@/lib/ingestion/youtube';
import { ingestReddit } from '@/lib/ingestion/reddit';
import { deduplicateRecentItems } from '@/lib/scoring/deduplication';
import type {
  IngestionJobData,
  ScoringJobData,
  DeduplicationJobData,
} from '@/lib/jobs/queue';

if (!redis) {
  console.error('Redis not configured. Workers cannot start.');
  process.exit(1);
}

console.log('🚀 Starting all workers...\n');

// Scoring Worker (TODO: migrate to new system)
const scoringWorker = new Worker<ScoringJobData>(
  'scoring',
  async (job: Job<ScoringJobData>) => {
    console.log(`Processing scoring job: ${job.id}`, job.data);

    try {
      // TODO: Implement scoring computation
      // await computeScores(job.data.window);
      console.log(`Scoring for ${job.data.window} completed`);
      return { success: true };
    } catch (error) {
      console.error('Scoring job failed:', error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

// Worker event handlers
scoringWorker.on('completed', (job) => {
  console.log(`Scoring job ${job.id} completed`);
});

scoringWorker.on('failed', (job, err) => {
  console.error(`Scoring job ${job?.id} failed:`, err);
});

console.log('✅ Legacy workers started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down all workers...');
  await scoringWorker.close();
  process.exit(0);
});
