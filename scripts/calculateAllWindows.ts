import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const { Pool } = pg;

const WINDOWS = [
  { name: 'now', hours: 12, label: 'NOW (12h)' },
  { name: '24h', hours: 24, label: '24 HOURS' },
  { name: '7d', hours: 168, label: '7 DAYS' }
];

async function calculateAllWindows() {
  console.log('📊 Calculating scores for all time windows...\n');
  
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
    
    // Calculate for each time window
    for (const window of WINDOWS) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📅 ${window.label} WINDOW`);
      console.log(`${'='.repeat(60)}\n`);
      
      // Get items for this window
      const itemsResult = await pool.query(`
        SELECT id, title, channel_title, published_at, metrics_snapshot
        FROM items
        WHERE published_at > NOW() - INTERVAL '${window.hours} hours'
        ORDER BY published_at DESC
      `);
      
      console.log(`Analyzing ${itemsResult.rows.length} items\n`);
      
      const scores = [];
      
      // Calculate scores for each entity
      for (const entity of entitiesResult.rows) {
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
      
      // Show top entities by type
      const byType = {
        character: scores.filter(s => s.type === 'character'),
        storyline: scores.filter(s => s.type === 'storyline'),
        show: scores.filter(s => s.type === 'show'),
        chatter: scores.filter(s => s.type === 'chatter'),
        clipper: scores.filter(s => s.type === 'clipper'),
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
      
      // Insert scores
      const computedAt = new Date();
      let insertCount = 0;
      
      for (let i = 0; i < scores.length; i++) {
        const s = scores[i];
        await pool.query(
          `INSERT INTO scores (entity_id, "window", rank, delta_rank, score, momentum, sources_breakdown, event_count, computed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (entity_id, "window", computed_at) DO UPDATE
           SET rank = $3, score = $5, momentum = $6`,
          [
            s.entityId,
            window.name,
            i + 1,
            0,
            s.score,
            s.momentum,
            JSON.stringify({ youtube: s.mentions }),
            s.mentions,
            computedAt
          ]
        );
        insertCount++;
      }
      
      console.log(`\n✅ Inserted ${insertCount} scores for ${window.name} window`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 ALL WINDOWS CALCULATED!`);
    console.log(`${'='.repeat(60)}\n`);
    
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

calculateAllWindows();
