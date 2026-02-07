import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const { Pool } = pg;

async function calculateClipperScores() {
  console.log('✂️ Ranking Top Clipping Channels...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Get all clipper channels and their performance
    const result = await pool.query(`
      SELECT 
        sa.id,
        sa.handle,
        sa.display_name,
        sa.channel_id,
        COUNT(DISTINCT i.id) as video_count,
        SUM((i.metrics_snapshot->>'views')::int) as total_views,
        SUM((i.metrics_snapshot->>'likes')::int) as total_likes,
        SUM((i.metrics_snapshot->>'comments')::int) as total_comments,
        AVG((i.metrics_snapshot->>'views')::int) as avg_views
      FROM source_accounts sa
      LEFT JOIN items i ON sa.id = i.source_account_id
      WHERE sa.tier = 'clippers' 
        AND sa.is_active = true
        AND i.published_at > NOW() - INTERVAL '48 hours'
      GROUP BY sa.id, sa.handle, sa.display_name, sa.channel_id
      ORDER BY total_views DESC
    `);
    
    console.log(`Found ${result.rows.length} clipper channels\n`);
    
    const clippers = result.rows.map(row => {
      const videoCount = parseInt(row.video_count) || 0;
      const totalViews = parseInt(row.total_views) || 0;
      const totalLikes = parseInt(row.total_likes) || 0;
      const totalComments = parseInt(row.total_comments) || 0;
      const avgViews = parseFloat(row.avg_views) || 0;
      
      // Score = (videos * 50) + (total_views / 10) + (likes * 2) + (comments * 3)
      const score = (videoCount * 50) + (totalViews / 10) + (totalLikes * 2) + (totalComments * 3);
      
      // Momentum = average views per video
      const momentum = avgViews / 100;
      
      return {
        handle: row.handle,
        displayName: row.display_name || row.handle,
        channelId: row.channel_id,
        videoCount,
        totalViews,
        totalLikes,
        totalComments,
        avgViews: Math.round(avgViews),
        score: Math.round(score),
        momentum: parseFloat(momentum.toFixed(2)),
      };
    }).sort((a, b) => b.score - a.score);
    
    console.log('🏆 Top Clipping Channels:\n');
    clippers.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.displayName}`);
      console.log(`     Videos: ${c.videoCount} | Views: ${c.totalViews.toLocaleString()} | Avg: ${c.avgViews.toLocaleString()}`);
      console.log(`     Score: ${c.score}\n`);
    });
    
    // Create clipper entities
    for (const clipper of clippers) {
      const entityResult = await pool.query(
        `INSERT INTO entities (type, canonical_name, description, enabled) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (canonical_name) DO UPDATE 
         SET description = $3, updated_at = NOW()
         RETURNING id`,
        [
          'clipper',
          clipper.displayName,
          `${clipper.videoCount} videos, ${clipper.totalViews.toLocaleString()} views`,
          true
        ]
      );
      
      const entityId = entityResult.rows[0].id;
      
      // Add handle as alias
      await pool.query(
        `INSERT INTO entity_aliases (entity_id, alias_text, match_type, platform_scope, confidence_weight) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (entity_id, alias_text, platform_scope) DO NOTHING`,
        [entityId, clipper.handle.toLowerCase(), 'exact', 'youtube', 1.0]
      );
    }
    
    // Insert scores
    const computedAt = new Date();
    for (let i = 0; i < clippers.length; i++) {
      const c = clippers[i];
      
      // Get entity ID
      const entityResult = await pool.query(
        `SELECT id FROM entities WHERE canonical_name = $1 AND type = 'clipper'`,
        [c.displayName]
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
          JSON.stringify({ youtube: c.videoCount }),
          c.videoCount,
          computedAt
        ]
      );
    }
    
    console.log(`✅ Inserted ${clippers.length} clipper scores\n`);
    console.log('🎉 Clipper ranking complete!');
    
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

calculateClipperScores();
