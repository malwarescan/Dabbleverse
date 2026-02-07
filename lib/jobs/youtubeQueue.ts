import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis';

// Define queues
export const youtubeQueue = new Queue('youtube', { connection: redisConnection });
export const dedupeQueue = new Queue('dedupe', { connection: redisConnection });
export const scoreQueue = new Queue('score', { connection: redisConnection });
export const feedQueue = new Queue('feed', { connection: redisConnection });

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
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
}
