import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '../../db/index';
import { sourceAccounts, items, itemMetricSnapshots } from '../../db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const MAX_UPLOADS_PER_CHANNEL = parseInt(process.env.YOUTUBE_MAX_UPLOADS_PER_CHANNEL || '25');

export async function pullUploads(job: Job) {
  const { tier } = job.data;
  
  console.log(`\n📥 Pulling uploads for tier: ${tier}`);
  
  // Get active channels for this tier that have been resolved
  const channels = await db.query.sourceAccounts.findMany({
    where: and(
      eq(sourceAccounts.platform, 'youtube'),
      eq(sourceAccounts.tier, tier),
      eq(sourceAccounts.isActive, true),
      isNotNull(sourceAccounts.channelId)
    ),
  });
  
  console.log(`  Found ${channels.length} channels to ingest`);
  
  let totalIngested = 0;
  let totalErrors = 0;
  
  for (const channel of channels) {
    if (!channel.channelId) continue;
    
    try {
      console.log(`\n  🎬 Processing: ${channel.displayName || channel.handle}`);
      
      // 1. Get uploads playlist ID
      const channelResponse = await youtube.channels.list({
        part: ['contentDetails'],
        id: [channel.channelId],
      });
      
      const uploadsPlaylistId = 
        channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      
      if (!uploadsPlaylistId) {
        console.log(`    ⚠️  No uploads playlist found`);
        continue;
      }
      
      // 2. Get latest videos from playlist
      const playlistResponse = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: MAX_UPLOADS_PER_CHANNEL,
      });
      
      const videoIds = playlistResponse.data.items?.map(
        item => item.contentDetails?.videoId
      ).filter(Boolean) as string[];
      
      if (videoIds.length === 0) {
        console.log(`    ⚠️  No videos found`);
        continue;
      }
      
      console.log(`    📹 Found ${videoIds.length} videos`);
      
      // 3. Get full video details + stats (batch up to 50)
      for (let i = 0; i < videoIds.length; i += 50) {
        const batchIds = videoIds.slice(i, i + 50);
        
        const videosResponse = await youtube.videos.list({
          part: ['snippet', 'statistics', 'contentDetails'],
          id: batchIds,
        });
        
        // 4. Upsert each video
        for (const video of videosResponse.data.items || []) {
          const videoId = video.id!;
          const snippet = video.snippet!;
          const stats = video.statistics || {};
          const contentDetails = video.contentDetails || {};
          
          // Parse duration (ISO 8601 format PT1H2M3S)
          const durationMatch = contentDetails.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          const durationSeconds = durationMatch 
            ? (parseInt(durationMatch[1] || '0') * 3600) +
              (parseInt(durationMatch[2] || '0') * 60) +
              (parseInt(durationMatch[3] || '0'))
            : null;
          
          try {
            // Upsert item
            const [item] = await db.insert(items)
              .values({
                platform: 'youtube',
                tier: channel.tier,
                sourceAccountId: channel.id,
                platformItemId: videoId,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                title: snippet.title || '',
                content: snippet.description || '',
                author: snippet.channelTitle || '',
                channelId: snippet.channelId || '',
                channelTitle: snippet.channelTitle || '',
                publishedAt: new Date(snippet.publishedAt!),
                fetchedAt: new Date(),
                durationSeconds,
                metricsSnapshot: {
                  views: parseInt(stats.viewCount || '0'),
                  likes: parseInt(stats.likeCount || '0'),
                  comments: parseInt(stats.commentCount || '0'),
                },
                rawPayload: video as any,
              })
              .onConflictDoUpdate({
                target: [items.platform, items.platformItemId],
                set: {
                  title: snippet.title || '',
                  content: snippet.description || '',
                  fetchedAt: new Date(),
                  durationSeconds,
                  metricsSnapshot: {
                    views: parseInt(stats.viewCount || '0'),
                    likes: parseInt(stats.likeCount || '0'),
                    comments: parseInt(stats.commentCount || '0'),
                  },
                  rawPayload: video as any,
                },
              })
              .returning();
            
            // Insert metric snapshot
            await db.insert(itemMetricSnapshots)
              .values({
                itemId: item.id,
                capturedAt: new Date(),
                views: parseInt(stats.viewCount || '0'),
                likes: parseInt(stats.likeCount || '0'),
                comments: parseInt(stats.commentCount || '0'),
              });
            
            totalIngested++;
            
          } catch (error: any) {
            console.error(`      ❌ Failed to upsert video ${videoId}:`, error.message);
            totalErrors++;
          }
        }
        
        // Rate limit: wait 100ms between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update channel's last_ingested_at
      await db.update(sourceAccounts)
        .set({ 
          lastIngestedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sourceAccounts.id, channel.id));
      
      console.log(`    ✅ Ingested ${videoIds.length} videos`);
      
      // Rate limit: wait 200ms between channels
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error: any) {
      console.error(`    ❌ Failed to process ${channel.displayName}:`, error.message);
      totalErrors++;
    }
  }
  
  console.log(`\n✅ Ingestion complete for ${tier}:`);
  console.log(`    Total items: ${totalIngested}`);
  console.log(`    Errors: ${totalErrors}`);
  
  return { 
    tier,
    channelsProcessed: channels.length,
    totalIngested,
    totalErrors
  };
}
