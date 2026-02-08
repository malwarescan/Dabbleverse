import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '../../db/index';
import { items, entities, entityAliases, youtubeCommentSnippets } from '../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import pg from 'pg';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

interface CommentData {
  videoId: string;
  authorDisplayName: string;
  authorChannelId: string;
  textOriginal: string;
  likeCount: number;
  publishedAt: string;
  totalReplyCount?: number;
}

export async function pullComments(job: Job) {
  console.log('\n💬 Pulling YouTube comments for recent videos...');
  
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Get recent videos from last 48 hours so every new upload gets comments pulled for breaking-story analysis
    const recentItems = await db
      .select({
        id: items.id,
        platformItemId: items.platformItemId,
        title: items.title,
        publishedAt: items.publishedAt,
      })
      .from(items)
      .where(
        sql`${items.platform} = 'youtube' 
            AND ${items.publishedAt} > NOW() - INTERVAL '48 hours'`
      )
      .orderBy(desc(items.publishedAt))
      .limit(50); // Cover more new uploads (clippers + main + weekly_wrap)

    console.log(`  Found ${recentItems.length} recent videos to analyze`);
    
    const chatterStats = new Map<string, {
      name: string;
      channelId: string;
      commentCount: number;
      totalLikes: number;
      totalReplies: number;
    }>();
    
    let totalComments = 0;
    
    // Fetch comments for each video
    for (const item of recentItems) {
      try {
        console.log(`  📹 Fetching comments for: ${item.title?.substring(0, 50)}...`);
        
        const response = await youtube.commentThreads.list({
          part: ['snippet'],
          videoId: item.platformItemId,
          maxResults: 100, // Top 100 comments per video
          order: 'relevance', // Get most relevant comments
        });
        
        const comments = response.data.items || [];
        totalComments += comments.length;
        
        // Process each comment: aggregate chatters + store text for budding-story analysis
        for (const thread of comments) {
          const topLevel = thread.snippet?.topLevelComment;
          const topLevelComment = topLevel?.snippet;
          if (!topLevelComment) continue;

          const commentId = topLevel?.id || '';
          const text = (topLevelComment.textDisplay || topLevelComment.textOriginal || '').replace(/<[^>]*>/g, '').trim();
          const authorName = topLevelComment.authorDisplayName || 'Unknown';
          const channelId = topLevelComment.authorChannelId?.value || 'unknown';
          const likeCount = topLevelComment.likeCount || 0;
          const replyCount = thread.snippet?.totalReplyCount || 0;

          // Store snippet for budding story analysis
          if (text.length > 0 && commentId) {
            await db.insert(youtubeCommentSnippets)
              .values({
                itemId: item.id,
                youtubeCommentId: commentId,
                text,
                authorDisplayName: authorName,
                likeCount,
                publishedAt: new Date(topLevelComment.publishedAt!),
              })
              .onConflictDoNothing({ target: [youtubeCommentSnippets.itemId, youtubeCommentSnippets.youtubeCommentId] });
          }

          // Aggregate stats per chatter
          if (!chatterStats.has(channelId)) {
            chatterStats.set(channelId, {
              name: authorName,
              channelId,
              commentCount: 0,
              totalLikes: 0,
              totalReplies: 0,
            });
          }
          const stats = chatterStats.get(channelId)!;
          stats.commentCount++;
          stats.totalLikes += likeCount;
          stats.totalReplies += replyCount;
        }
        
        // Rate limit: 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`    ❌ Failed to fetch comments for video: ${error.message}`);
      }
    }
    
    console.log(`\n  💬 Processed ${totalComments} comments from ${chatterStats.size} unique chatters`);
    
    // Create/update chatter entities
    let chatterCount = 0;
    for (const [channelId, stats] of chatterStats) {
      // Only create entities for chatters with 3+ comments
      if (stats.commentCount < 3) continue;
      
      // Upsert chatter entity
      const result = await pool.query(
        `INSERT INTO entities (type, canonical_name, description, enabled) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (canonical_name) DO UPDATE 
         SET description = $3, updated_at = NOW()
         RETURNING id`,
        [
          'chatter',
          stats.name,
          `${stats.commentCount} comments, ${stats.totalLikes} likes`,
          true
        ]
      );
      
      const entityId = result.rows[0].id;
      
      // Add channel ID as alias
      await pool.query(
        `INSERT INTO entity_aliases (entity_id, alias_text, match_type, platform_scope, confidence_weight) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (entity_id, alias_text, platform_scope) DO NOTHING`,
        [entityId, stats.name.toLowerCase(), 'exact', 'youtube', 1.0]
      );
      
      chatterCount++;
    }
    
    console.log(`  ✅ Created/updated ${chatterCount} chatter entities`);
    
    return {
      videosAnalyzed: recentItems.length,
      totalComments,
      uniqueChatters: chatterStats.size,
      topChatters: chatterCount,
    };
    
  } catch (error: any) {
    console.error('❌ Failed to pull comments:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}
