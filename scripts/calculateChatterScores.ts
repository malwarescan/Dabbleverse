import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const { Pool } = pg;

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

async function calculateChatterScores() {
  console.log('💬 Analyzing YouTube comments to find top chatters...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Get recent videos from last 48 hours
    const videosResult = await pool.query(`
      SELECT platform_item_id, title
      FROM items
      WHERE platform = 'youtube' 
        AND published_at > NOW() - INTERVAL '48 hours'
      ORDER BY published_at DESC
      LIMIT 30
    `);
    
    console.log(`Found ${videosResult.rows.length} recent videos\n`);
    
    const chatterStats = new Map<string, {
      name: string;
      channelId: string;
      commentCount: number;
      totalLikes: number;
      totalReplies: number;
    }>();
    
    let totalComments = 0;
    let processedVideos = 0;
    
    // Fetch comments for each video
    for (const video of videosResult.rows) {
      try {
        console.log(`  📹 ${video.title?.substring(0, 60)}...`);
        
        const response = await youtube.commentThreads.list({
          part: ['snippet'],
          videoId: video.platform_item_id,
          maxResults: 100,
          order: 'relevance',
        });
        
        const comments = response.data.items || [];
        totalComments += comments.length;
        processedVideos++;
        
        for (const thread of comments) {
          const comment = thread.snippet?.topLevelComment?.snippet;
          if (!comment) continue;
          
          const name = comment.authorDisplayName || 'Unknown';
          const channelId = comment.authorChannelId?.value || 'unknown';
          const likes = comment.likeCount || 0;
          const replies = thread.snippet?.totalReplyCount || 0;
          
          if (!chatterStats.has(channelId)) {
            chatterStats.set(channelId, {
              name,
              channelId,
              commentCount: 0,
              totalLikes: 0,
              totalReplies: 0,
            });
          }
          
          const stats = chatterStats.get(channelId)!;
          stats.commentCount++;
          stats.totalLikes += likes;
          stats.totalReplies += replies;
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error: any) {
        console.error(`    ❌ Error: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Stats:`);
    console.log(`  Videos analyzed: ${processedVideos}`);
    console.log(`  Total comments: ${totalComments}`);
    console.log(`  Unique chatters: ${chatterStats.size}\n`);
    
    // Filter to active chatters (3+ comments)
    const activeChatters = Array.from(chatterStats.values())
      .filter(c => c.commentCount >= 3);
    
    console.log(`  Active chatters (3+ comments): ${activeChatters.length}\n`);
    
    // Create chatter entities
    for (const chatter of activeChatters) {
      const result = await pool.query(
        `INSERT INTO entities (type, canonical_name, description, enabled) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (canonical_name) DO UPDATE 
         SET description = $3, updated_at = NOW()
         RETURNING id`,
        ['chatter', chatter.name, `${chatter.commentCount} comments, ${chatter.totalLikes} likes`, true]
      );
      
      const entityId = result.rows[0].id;
      
      await pool.query(
        `INSERT INTO entity_aliases (entity_id, alias_text, match_type, platform_scope, confidence_weight) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (entity_id, alias_text, platform_scope) DO NOTHING`,
        [entityId, chatter.name.toLowerCase(), 'exact', 'youtube', 1.0]
      );
    }
    
    // Calculate scores for chatters
    const scores = activeChatters.map(c => {
      // Score = (comments * 100) + (likes * 5) + (replies * 3)
      const score = (c.commentCount * 100) + (c.totalLikes * 5) + (c.totalReplies * 3);
      // Momentum = engagement rate
      const momentum = (c.totalLikes + c.totalReplies) / c.commentCount;
      
      return {
        ...c,
        score,
        momentum: parseFloat(momentum.toFixed(2)),
      };
    }).sort((a, b) => b.score - a.score);
    
    console.log(`\n🏆 Top 10 Chatters:\n`);
    scores.slice(0, 10).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name}: ${c.score} (${c.commentCount} comments, ${c.totalLikes} likes)`);
    });
    
    // Insert scores
    const computedAt = new Date();
    for (let i = 0; i < scores.length; i++) {
      const c = scores[i];
      
      // Get entity ID
      const entityResult = await pool.query(
        `SELECT id FROM entities WHERE canonical_name = $1 AND type = 'chatter'`,
        [c.name]
      );
      
      if (entityResult.rows.length === 0) continue;
      const entityId = entityResult.rows[0].id;
      
      await pool.query(
        `INSERT INTO scores (entity_id, "window", rank, delta_rank, score, momentum, sources_breakdown, event_count, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (entity_id, "window", computed_at) DO UPDATE
         SET rank = $3, score = $5, momentum = $6`,
        [
          entityId,
          'now',
          i + 1,
          0,
          c.score,
          c.momentum,
          JSON.stringify({ youtube: c.commentCount }),
          c.commentCount,
          computedAt
        ]
      );
    }
    
    console.log(`\n✅ Inserted ${scores.length} chatter scores\n`);
    console.log('🎉 Chatter analysis complete!');
    
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

calculateChatterScores();
