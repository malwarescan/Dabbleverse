import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const { Pool } = pg;

async function calculateScores() {
  console.log('📊 Calculating entity scores from items...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Get all entities and their aliases
    const entitiesResult = await pool.query(`
      SELECT e.id, e.canonical_name, e.type,
             array_agg(DISTINCT LOWER(a.alias_text)) as aliases
      FROM entities e
      LEFT JOIN entity_aliases a ON e.id = a.entity_id
      WHERE e.enabled = true
      GROUP BY e.id, e.canonical_name, e.type
    `);
    
    console.log(`Found ${entitiesResult.rows.length} entities\n`);
    
    // Get recent items (last 48 hours to get more data)
    const itemsResult = await pool.query(`
      SELECT id, title, channel_title, published_at, metrics_snapshot
      FROM items
      WHERE published_at > NOW() - INTERVAL '48 hours'
      ORDER BY published_at DESC
    `);
    
    console.log(`Analyzing ${itemsResult.rows.length} recent items\n`);
    
    // Calculate scores for each entity
    const scores = [];
    
    for (const entity of entitiesResult.rows) {
      let mentions = 0;
      let totalViews = 0;
      let totalLikes = 0;
      
      // Count mentions in video titles
      for (const item of itemsResult.rows) {
        const titleLower = (item.title || '').toLowerCase();
        const channelLower = (item.channel_title || '').toLowerCase();
        const combined = `${titleLower} ${channelLower}`;
        
        // Check if any alias matches
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
        const momentum = (totalViews / mentions) / 100; // Simple velocity-based momentum
        
        scores.push({
          entityId: entity.id,
          name: entity.canonical_name,
          type: entity.type,
          score: Math.round(score),
          momentum: parseFloat(momentum.toFixed(2)),
          mentions,
          totalViews,
        });
      }
    }
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    // Group by type
    const byType = {
      character: scores.filter(s => s.type === 'character'),
      storyline: scores.filter(s => s.type === 'storyline'),
      show: scores.filter(s => s.type === 'show'),
    };
    
    console.log(`\n📈 Top 10 Characters:\n`);
    byType.character.slice(0, 10).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name}: ${s.score} (${s.mentions} mentions, ${s.totalViews.toLocaleString()} views)`);
    });
    
    console.log(`\n📖 Top 10 Storylines:\n`);
    byType.storyline.slice(0, 10).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name}: ${s.score} (${s.mentions} mentions)`);
    });
    
    console.log(`\n📺 Top 10 Shows:\n`);
    byType.show.slice(0, 10).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name}: ${s.score} (${s.mentions} mentions)`);
    });
    
    // Insert scores into database
    const computedAt = new Date();
    let insertCount = 0;
    
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i];
      await pool.query(
        `INSERT INTO scores (entity_id, "window", rank, delta_rank, score, momentum, micro_momentum, sources_breakdown, driver_label, event_count, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (entity_id, "window", computed_at) DO UPDATE
         SET rank = $3, score = $5, momentum = $6`,
        [
          s.entityId,
          'now', // window
          i + 1, // rank
          0, // delta_rank
          s.score,
          s.momentum,
          null, // micro_momentum
          JSON.stringify({ youtube: s.mentions }), // sources_breakdown
          null, // driver_label
          s.mentions, // event_count
          computedAt
        ]
      );
      insertCount++;
    }
    
    console.log(`\n✅ Inserted ${insertCount} scores into database\n`);
    console.log('🎉 Score calculation complete!');
    
  } catch (error: any) {
    console.error('❌ Scoring failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

calculateScores();
