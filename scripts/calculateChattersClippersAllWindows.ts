import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const { Pool } = pg;

const WINDOWS = [
  { name: 'now', hours: 12 },
  { name: '24h', hours: 24 },
  { name: '7d', hours: 168 }
];

async function calculateAll() {
  console.log('✂️💬 Calculating chatters & clippers for all windows...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    const computedAt = new Date();
    
    // For each window, calculate clipper scores
    for (const window of WINDOWS) {
      console.log(`\n📅 ${window.name.toUpperCase()} WINDOW (${window.hours}h)`);
      
      // Get clipper performance for this window
      const clippersResult = await pool.query(`
        SELECT 
          sa.id,
          sa.handle,
          sa.display_name,
          COUNT(DISTINCT i.id) as video_count,
          SUM((i.metrics_snapshot->>'views')::int) as total_views,
          SUM((i.metrics_snapshot->>'likes')::int) as total_likes,
          AVG((i.metrics_snapshot->>'views')::int) as avg_views
        FROM source_accounts sa
        LEFT JOIN items i ON sa.id = i.source_account_id
        WHERE sa.tier = 'clippers' 
          AND sa.is_active = true
          AND i.published_at > NOW() - INTERVAL '${window.hours} hours'
        GROUP BY sa.id, sa.handle, sa.display_name
        HAVING COUNT(DISTINCT i.id) > 0
        ORDER BY total_views DESC
      `);
      
      console.log(`  ✂️  Found ${clippersResult.rows.length} active clippers`);
      
      // Calculate and insert clipper scores
      for (let i = 0; i < clippersResult.rows.length; i++) {
        const row = clippersResult.rows[i];
        const videoCount = parseInt(row.video_count) || 0;
        const totalViews = parseInt(row.total_views) || 0;
        const totalLikes = parseInt(row.total_likes) || 0;
        const avgViews = parseFloat(row.avg_views) || 0;
        
        const score = (videoCount * 50) + (totalViews / 10) + (totalLikes * 2);
        const momentum = avgViews / 100;
        
        // Get entity ID
        const entityResult = await pool.query(
          `SELECT id FROM entities WHERE canonical_name = $1 AND type = 'clipper'`,
          [row.display_name || row.handle]
        );
        
        if (entityResult.rows.length === 0) continue;
        const entityId = entityResult.rows[0].id;
        
        await pool.query(
          `INSERT INTO scores (entity_id, "window", rank, score, momentum, sources_breakdown, event_count, computed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (entity_id, "window", computed_at) DO UPDATE
           SET rank = $3, score = $4, momentum = $5`,
          [
            entityId,
            window.name,
            i + 1,
            Math.round(score),
            parseFloat(momentum.toFixed(2)),
            JSON.stringify({ youtube: videoCount }),
            videoCount,
            computedAt
          ]
        );
      }
      
      // Get chatter performance for this window (existing entities only)
      const chattersResult = await pool.query(`
        SELECT id, canonical_name 
        FROM entities 
        WHERE type = 'chatter' AND enabled = true
      `);
      
      console.log(`  💬 Found ${chattersResult.rows.length} chatters (using existing scores)`);
      
      // Copy chatter scores to all windows (they're already calculated)
      for (let i = 0; i < chattersResult.rows.length; i++) {
        const chatter = chattersResult.rows[i];
        
        // Get their existing score from 'now' window
        const existingScore = await pool.query(
          `SELECT score, momentum, event_count, sources_breakdown
           FROM scores 
           WHERE entity_id = $1 AND "window" = 'now'
           ORDER BY computed_at DESC LIMIT 1`,
          [chatter.id]
        );
        
        if (existingScore.rows.length === 0) continue;
        
        const { score, momentum, event_count, sources_breakdown } = existingScore.rows[0];
        
        await pool.query(
          `INSERT INTO scores (entity_id, "window", rank, score, momentum, sources_breakdown, event_count, computed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (entity_id, "window", computed_at) DO UPDATE
           SET rank = $3, score = $4, momentum = $5`,
          [chatter.id, window.name, i + 1, score, momentum, sources_breakdown, event_count, computedAt]
        );
      }
    }
    
    console.log(`\n✅ All chatters & clippers calculated for all windows!\n`);
    
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

calculateAll();
