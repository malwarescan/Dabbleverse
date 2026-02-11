import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis';

// Lazy queues so no Redis connection at build time (Next.js collect page data can't resolve redis.railway.internal)
let _youtubeQueue: Queue | null = null;
let _dedupeQueue: Queue | null = null;
let _scoreQueue: Queue | null = null;
let _feedQueue: Queue | null = null;

function getYoutubeQueue() {
  if (!_youtubeQueue) _youtubeQueue = new Queue('youtube', { connection: redisConnection });
  return _youtubeQueue;
}
function getDedupeQueue() {
  if (!_dedupeQueue) _dedupeQueue = new Queue('dedupe', { connection: redisConnection });
  return _dedupeQueue;
}
function getScoreQueue() {
  if (!_scoreQueue) _scoreQueue = new Queue('score', { connection: redisConnection });
  return _scoreQueue;
}
function getFeedQueue() {
  if (!_feedQueue) _feedQueue = new Queue('feed', { connection: redisConnection });
  return _feedQueue;
}

export const youtubeQueue = new Proxy({} as Queue, { get(_, prop) { return (getYoutubeQueue() as unknown as Record<string, unknown>)[prop as string]; } });
export const dedupeQueue = new Proxy({} as Queue, { get(_, prop) { return (getDedupeQueue() as unknown as Record<string, unknown>)[prop as string]; } });
export const scoreQueue = new Proxy({} as Queue, { get(_, prop) { return (getScoreQueue() as unknown as Record<string, unknown>)[prop as string]; } });
export const feedQueue = new Proxy({} as Queue, { get(_, prop) { return (getFeedQueue() as unknown as Record<string, unknown>)[prop as string]; } });

// Schedule all recurring jobs
export async function scheduleYouTubeJobs() {
  console.log('📅 Scheduling YouTube jobs...\n');
  
  try {
    // 1. Resolve channels (run once on startup)
    await youtubeQueue.add('resolve_channels', {}, { 
      jobId: 'resolve_channels_once',
      removeOnComplete: 100,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: resolve_channels (run once)');
    
    // 2. Pull uploads - clippers tier (every 10 minutes)
    await youtubeQueue.add('pull_uploads', { tier: 'clippers' }, {
      repeat: { 
        pattern: '*/10 * * * *', // Every 10 minutes
      },
      jobId: 'pull_uploads_clippers',
      removeOnComplete: 10,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: pull_uploads_clippers (every 10 min)');
    
    // 3. Pull uploads - weekly_wrap tier (every 30 minutes)
    await youtubeQueue.add('pull_uploads', { tier: 'weekly_wrap' }, {
      repeat: { 
        pattern: '*/30 * * * *', // Every 30 minutes
      },
      jobId: 'pull_uploads_weekly',
      removeOnComplete: 10,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: pull_uploads_weekly (every 30 min)');

    // 3b. Pull uploads - main (character) tier: titles, descriptions, live stream summaries for breaking stories
    await youtubeQueue.add('pull_uploads', { tier: 'main' }, {
      repeat: { pattern: '*/15 * * * *' }, // Every 15 min
      jobId: 'pull_uploads_main',
      removeOnComplete: 10,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: pull_uploads_main (every 15 min)');
    
    // 4. Refresh stats (every 15 minutes)
    await youtubeQueue.add('refresh_stats', {}, {
      repeat: { 
        pattern: '*/15 * * * *', // Every 15 minutes
      },
      jobId: 'refresh_stats',
      removeOnComplete: 10,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: refresh_stats (every 15 min)');

    // 4b. Pull comments (for chatters + budding-story analysis)
    await youtubeQueue.add('pull_comments', {}, {
      repeat: { pattern: '*/30 * * * *' },
      jobId: 'pull_comments',
      removeOnComplete: 10,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: pull_comments (every 30 min)');

    // 4c. Detect budding stories from comments + video descriptions
    await youtubeQueue.add('detect_budding_stories', { window: '24h' }, {
      repeat: { pattern: '*/20 * * * *' },
      jobId: 'detect_budding_stories_24h',
      removeOnComplete: 10,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: detect_budding_stories (every 20 min)');
    
    // 5. Dedupe events (every 10 minutes)
    await dedupeQueue.add('dedupe_events', {}, {
      repeat: { 
        pattern: '*/10 * * * *', // Every 10 minutes
      },
      jobId: 'dedupe_events',
      removeOnComplete: 10,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: dedupe_events (every 10 min)');
    
    // 6. Build feed cards (every 5 minutes)
    await feedQueue.add('build_feed_cards', {}, {
      repeat: { 
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      jobId: 'build_feed_cards',
      removeOnComplete: 10,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: build_feed_cards (every 5 min)');

    // Playboard: detect live streams every 90 sec, poll chat every 10 sec
    await youtubeQueue.add('detect_live_streams', {}, {
      repeat: { pattern: '*/2 * * * *' }, // every 2 min (cron min granularity; for 90s use a different approach or accept 2 min)
      jobId: 'detect_live_streams',
      removeOnComplete: 20,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: detect_live_streams (every 2 min)');

    await youtubeQueue.add('poll_live_chat', {}, {
      repeat: { pattern: '*/1 * * * *' }, // every 1 min (every 10 sec would need a separate loop or worker)
      jobId: 'poll_live_chat',
      removeOnComplete: 30,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: poll_live_chat (every 1 min)');

    await youtubeQueue.add('sample_concurrency', {}, {
      repeat: { pattern: '*/1 * * * *' },
      jobId: 'sample_concurrency',
      removeOnComplete: 30,
      removeOnFail: false,
    });
    console.log('  ✅ Scheduled: sample_concurrency (every 1 min)');
    
    console.log('\n🎉 All YouTube jobs scheduled successfully!');
    
  } catch (error) {
    console.error('💥 Failed to schedule jobs:', error);
    throw error;
  }
}

// Helper to trigger a job manually (for testing)
export async function triggerJob(jobName: string, data: any = {}) {
  console.log(`🎬 Manually triggering job: ${jobName}`);
  
  switch (jobName) {
    case 'resolve_channels':
      return await youtubeQueue.add('resolve_channels', data);
    case 'pull_uploads':
      return await youtubeQueue.add('pull_uploads', data);
    case 'refresh_stats':
      return await youtubeQueue.add('refresh_stats', data);
    case 'dedupe_events':
      return await dedupeQueue.add('dedupe_events', data);
    case 'build_feed_cards':
      return await feedQueue.add('build_feed_cards', data);
    case 'pull_comments':
      return await youtubeQueue.add('pull_comments', data);
    case 'detect_budding_stories':
      return await youtubeQueue.add('detect_budding_stories', { window: data.window || '24h' });
    case 'detect_live_streams':
      return await youtubeQueue.add('detect_live_streams', {});
    case 'poll_live_chat':
      return await youtubeQueue.add('poll_live_chat', data);
    case 'sample_concurrency':
      return await youtubeQueue.add('sample_concurrency', data);
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
}
