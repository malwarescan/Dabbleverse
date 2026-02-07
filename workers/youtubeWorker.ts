import { Worker } from 'bullmq';
import { redisConnection } from '../lib/utils/redis';
import { resolveChannels } from '../lib/jobs/processors/resolveChannels';
import { pullUploads } from '../lib/jobs/processors/pullUploads';
import { refreshStats } from '../lib/jobs/processors/refreshStats';
import { deduplicateYouTubeItems } from '../lib/scoring/deduplication';
import { buildFeedCards } from '../lib/jobs/processors/buildFeedCards';
import { scheduleYouTubeJobs } from '../lib/jobs/youtubeQueue';

// YouTube worker
const youtubeWorker = new Worker('youtube', async (job) => {
  console.log(`\n[YouTube Worker] Processing job: ${job.name} (ID: ${job.id})`);
  const startTime = Date.now();
  
  try {
    let result;
    
    switch (job.name) {
      case 'resolve_channels':
        result = await resolveChannels(job);
        break;
      case 'pull_uploads':
        result = await pullUploads(job);
        break;
      case 'refresh_stats':
        result = await refreshStats(job);
        break;
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[YouTube Worker] ✅ Job ${job.name} completed in ${duration}ms`);
    
    return result;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[YouTube Worker] ❌ Job ${job.name} failed after ${duration}ms:`, error.message);
    throw error;
  }
}, { 
  connection: redisConnection,
  concurrency: 1, // Process one job at a time
});

// Dedupe worker
const dedupeWorker = new Worker('dedupe', async (job) => {
  console.log(`\n[Dedupe Worker] Processing job: ${job.name} (ID: ${job.id})`);
  const startTime = Date.now();
  
  try {
    let result;
    
    if (job.name === 'dedupe_events') {
      result = await deduplicateYouTubeItems();
    } else {
      throw new Error(`Unknown job: ${job.name}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[Dedupe Worker] ✅ Job ${job.name} completed in ${duration}ms`);
    
    return result;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Dedupe Worker] ❌ Job ${job.name} failed after ${duration}ms:`, error.message);
    throw error;
  }
}, { 
  connection: redisConnection,
  concurrency: 1,
});

// Feed worker
const feedWorker = new Worker('feed', async (job) => {
  console.log(`\n[Feed Worker] Processing job: ${job.name} (ID: ${job.id})`);
  const startTime = Date.now();
  
  try {
    let result;
    
    if (job.name === 'build_feed_cards') {
      result = await buildFeedCards(job);
    } else {
      throw new Error(`Unknown job: ${job.name}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[Feed Worker] ✅ Job ${job.name} completed in ${duration}ms`);
    
    return result;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Feed Worker] ❌ Job ${job.name} failed after ${duration}ms:`, error.message);
    throw error;
  }
}, { 
  connection: redisConnection,
  concurrency: 1,
});

// Event handlers
[youtubeWorker, dedupeWorker, feedWorker].forEach(worker => {
  worker.on('completed', (job) => {
    console.log(`✅ [${worker.name}] Job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`❌ [${worker.name}] Job ${job?.id} failed:`, err.message);
  });
  
  worker.on('error', (err) => {
    console.error(`💥 [${worker.name}] Worker error:`, err);
  });
});

// Schedule all jobs on startup
(async () => {
  try {
    await scheduleYouTubeJobs();
    console.log('\n🚀 YouTube workers started and jobs scheduled!');
  } catch (error) {
    console.error('💥 Failed to schedule jobs:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM received, closing workers...');
  await Promise.all([
    youtubeWorker.close(),
    dedupeWorker.close(),
    feedWorker.close(),
  ]);
  console.log('👋 Workers closed gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, closing workers...');
  await Promise.all([
    youtubeWorker.close(),
    dedupeWorker.close(),
    feedWorker.close(),
  ]);
  console.log('👋 Workers closed gracefully');
  process.exit(0);
});

console.log('🔧 YouTube workers initialized');
