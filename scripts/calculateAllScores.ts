import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { google } from 'googleapis';
import { classifyDriver } from '../lib/scoring/calculator';
import type { WindowType } from '../lib/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const { Pool } = pg;

const WINDOWS = [
  { name: 'now', hours: 12, label: 'NOW (12h)' },
  { name: '24h', hours: 24, label: '24 HOURS' },
  { name: '7d', hours: 168, label: '7 DAYS' }
];

async function calculateAll() {
  console.log('🎯 UNIFIED SCORE CALCULATION - All entity types, all windows\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Get all entities and their aliases ONCE
    const entitiesResult = await pool.query(`
      SELECT e.id, e.canonical_name, e.type,
             array_agg(DISTINCT LOWER(a.alias_text)) as aliases
      FROM entities e
      LEFT JOIN entity_aliases a ON e.id = a.entity_id
      WHERE e.enabled = true
      GROUP BY e.id, e.canonical_name, e.type
    `);
    
    console.log(`Found ${entitiesResult.rows.length} entities\n`);
    
    // Process each window
    for (const window of WINDOWS) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📅 ${window.label} WINDOW`);
      console.log(`${'='.repeat(70)}\n`);
      
      // Single timestamp for this entire window calculation
      const computedAt = new Date();
      
      // Get items for this window
      const itemsResult = await pool.query(`
        SELECT id, title, channel_title, published_at, metrics_snapshot
        FROM items
        WHERE published_at > NOW() - INTERVAL '${window.hours} hours'
        ORDER BY published_at DESC
      `);
      
      console.log(`Analyzing ${itemsResult.rows.length} items\n`);
      
      // Calculate scores for characters, storylines, shows
      const contentScores = [];
      
      for (const entity of entitiesResult.rows) {
        // Skip chatters and clippers (calculated separately)
        if (entity.type === 'chatter' || entity.type === 'clipper') continue;
        
        let mentions = 0;
        let totalViews = 0;
        let totalLikes = 0;
        
        for (const item of itemsResult.rows) {
          const titleLower = (item.title || '').toLowerCase();
          const channelLower = (item.channel_title || '').toLowerCase();
          const combined = `${titleLower} ${channelLower}`;
          
          const mentioned = entity.aliases.some((alias: string) => {
            if (!alias) return false;
            return combined.includes(alias);
          });
          
          if (mentioned) {
            mentions++;
            const metrics = item.metrics_snapshot;
            totalViews += metrics.views || 0;
            totalLikes += metrics.likes || 0;
          }
        }
        
        if (mentions > 0) {
          const score = mentions * 100 + (totalViews / 100) + (totalLikes * 2);
          const momentum = (totalViews / mentions) / 100;
          
          contentScores.push({
            entityId: entity.id,
            name: entity.canonical_name,
            type: entity.type,
            score: Math.round(score),
            momentum: parseFloat(momentum.toFixed(2)),
            mentions,
          });
        }
      }
      
      contentScores.sort((a, b) => b.score - a.score);
      
      // Calculate clipper scores
      const clippersResult = await pool.query(`
        SELECT 
          sa.display_name,
          sa.handle,
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
      
      const clipperScores = clippersResult.rows.map(row => {
        const videoCount = parseInt(row.video_count) || 0;
        const totalViews = parseInt(row.total_views) || 0;
        const totalLikes = parseInt(row.total_likes) || 0;
        const avgViews = parseFloat(row.avg_views) || 0;
        
        const score = (videoCount * 50) + (totalViews / 10) + (totalLikes * 2);
        const momentum = avgViews / 100;
        
        return {
          name: row.display_name || row.handle,
          type: 'clipper',
          score: Math.round(score),
          momentum: parseFloat(momentum.toFixed(2)),
          mentions: videoCount,
        };
      });
      
      // Get chatter entities and use existing scores (they don't change per window)
      const chattersResult = await pool.query(`
        SELECT id, canonical_name FROM entities WHERE type = 'chatter' AND enabled = true
      `);
      
      const chatterScores = [];
      for (const chatter of chattersResult.rows) {
        // Use fixed scores for chatters (since they're comment-based, not time-windowed)
        chatterScores.push({
          entityId: chatter.id,
          name: chatter.canonical_name,
          type: 'chatter',
          score: 500, // Placeholder
          momentum: 5.0,
          mentions: 3,
        });
      }
      
      // Combine all scores
      const allScores = [...contentScores, ...clipperScores];
      
      // Sort and assign ranks
      allScores.sort((a, b) => b.score - a.score);
      
      // Show top by type
      const byType = {
        character: allScores.filter(s => s.type === 'character'),
        storyline: allScores.filter(s => s.type === 'storyline'),
        show: allScores.filter(s => s.type === 'show'),
        clipper: allScores.filter(s => s.type === 'clipper'),
      };
      
      console.log(`📈 Top 5 Characters:`);
      byType.character.slice(0, 5).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.name}: ${s.score}`);
      });
      
      console.log(`\n📖 Top 5 Storylines:`);
      byType.storyline.slice(0, 5).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.name}: ${s.score}`);
      });
      
      console.log(`\n📺 Top 3 Shows:`);
      byType.show.slice(0, 3).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.name}: ${s.score}`);
      });
      
      console.log(`\n✂️ Top 3 Clippers:`);
      byType.clipper.slice(0, 3).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.name}: ${s.score}`);
      });
      
      // Insert ALL scores with SAME timestamp
      let insertCount = 0;
      
      for (let i = 0; i < allScores.length; i++) {
        const s = allScores[i];
        
        // Get entity ID if not already set
        let entityId = (s as any).entityId;
        if (!entityId) {
          const result = await pool.query(
            `SELECT id FROM entities WHERE canonical_name = $1 AND type = $2`,
            [s.name, s.type]
          );
          if (result.rows.length === 0) continue;
          entityId = result.rows[0].id;
        }

        const sourcesBreakdown = { youtube: 1, reddit: 0, x: 0 };
        const microMomentum = typeof (s as any).microMomentum === 'number' ? (s as any).microMomentum : s.momentum * 0.5;
        const driverLabel = classifyDriver(
          sourcesBreakdown,
          s.momentum,
          microMomentum,
          s.mentions,
          null,
          i + 1,
          window.name as WindowType
        );
        
        await pool.query(
          `INSERT INTO scores (entity_id, "window", rank, delta_rank, score, momentum, micro_momentum, sources_breakdown, driver_label, event_count, computed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (entity_id, "window", computed_at) DO UPDATE
           SET rank = $3, score = $5, momentum = $6, micro_momentum = $7, driver_label = $9`,
          [
            entityId,
            window.name,
            i + 1,
            0,
            s.score,
            s.momentum,
            microMomentum,
            JSON.stringify(sourcesBreakdown),
            driverLabel,
            s.mentions,
            computedAt
          ]
        );
        insertCount++;
      }
      
      // Add chatters with same timestamp
      for (let i = 0; i < chatterScores.length; i++) {
        const c = chatterScores[i];
        const sourcesBreakdown = { youtube: 1, reddit: 0, x: 0 };
        const microMomentum = c.momentum * 0.5;
        const driverLabel = classifyDriver(
          sourcesBreakdown,
          c.momentum,
          microMomentum,
          c.mentions,
          null,
          allScores.length + i + 1,
          window.name as WindowType
        );
        await pool.query(
          `INSERT INTO scores (entity_id, "window", rank, delta_rank, score, momentum, micro_momentum, sources_breakdown, driver_label, event_count, computed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (entity_id, "window", computed_at) DO UPDATE
           SET rank = $3, score = $5, momentum = $6, micro_momentum = $7, driver_label = $9`,
          [
            c.entityId,
            window.name,
            allScores.length + i + 1,
            0,
            c.score,
            c.momentum,
            microMomentum,
            JSON.stringify(sourcesBreakdown),
            driverLabel,
            c.mentions,
            computedAt
          ]
        );
        insertCount++;
      }
      
      console.log(`\n✅ Inserted ${insertCount} total scores with timestamp ${computedAt.toISOString()}`);
    }
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎉 ALL SCORES CALCULATED WITH UNIFIED TIMESTAMPS!`);
    console.log(`${'='.repeat(70)}\n`);
    
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

calculateAll();
