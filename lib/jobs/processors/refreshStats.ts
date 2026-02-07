import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '../../db/index';
import { items, itemMetricSnapshots } from '../../db/schema';
import { gte, eq, and } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const LOOKBACK_HOURS = parseInt(process.env.YOUTUBE_STATS_REFRESH_LOOKBACK_HOURS || '48');

export async function refreshStats(job: Job) {
  console.log('\n🔄 Refreshing YouTube stats...');
  
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
  
  // Get recent items
  const recentItems = await db.query.items.findMany({
    where: and(
      eq(items.platform, 'youtube'),
      gte(items.publishedAt, cutoff)
    ),
    columns: {
      id: true,
      platformItemId: true,
    },
  });
  
  console.log(`  Found ${recentItems.length} items to refresh (last ${LOOKBACK_HOURS}h)`);
  
  // Batch into groups of 50 (YouTube API limit)
  const batches = [];
  for (let i = 0; i < recentItems.length; i += 50) {
    batches.push(recentItems.slice(i, i + 50));
  }
  
  console.log(`  Processing ${batches.length} batches...`);
  
  let totalRefreshed = 0;
  let totalErrors = 0;
  
  for (const [index, batch] of batches.entries()) {
    const videoIds = batch.map(item => item.platformItemId);
    
    try {
      const response = await youtube.videos.list({
        part: ['statistics'],
        id: videoIds,
      });
      
      for (const video of response.data.items || []) {
        const videoId = video.id!;
        const stats = video.statistics || {};
        const item = batch.find(i => i.platformItemId === videoId);
        
        if (!item) continue;
        
        // Insert new snapshot
        await db.insert(itemMetricSnapshots)
          .values({
            itemId: item.id,
            capturedAt: new Date(),
            views: parseInt(stats.viewCount || '0'),
            likes: parseInt(stats.likeCount || '0'),
            comments: parseInt(stats.commentCount || '0'),
          });
        
        totalRefreshed++;
      }
      
      console.log(`    Batch ${index + 1}/${batches.length}: ✅ ${response.data.items?.length || 0} videos`);
      
      // Rate limit: wait 100ms between batches
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`    Batch ${index + 1}/${batches.length}: ❌`, error.message);
      totalErrors++;
    }
  }
  
  console.log(`\n✅ Stats refresh complete:`);
  console.log(`    Refreshed: ${totalRefreshed}`);
  console.log(`    Errors: ${totalErrors}`);
  
  return { 
    totalItems: recentItems.length,
    totalRefreshed,
    totalErrors
  };
}
