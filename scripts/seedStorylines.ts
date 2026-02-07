import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const { Pool } = pg;

const storylines = [
  { name: "Stuttering John vs. Shuli", aliases: ["john vs shuli", "shuli vs john", "john shuli beef"] },
  { name: "Steel Toe Money Drama", aliases: ["steel toe money", "aaron begging", "steel toe broke"] },
  { name: "Opie vs. Anthony", aliases: ["opie anthony", "o&a beef", "opie vs cumia"] },
  { name: "Zumock Meltdown", aliases: ["zumock meltdown", "chad meltdown", "zumock breakdown"] },
  { name: "Kevin Brennan Comedy Feud", aliases: ["kevin brennan feud", "kb beef"] },
  { name: "Keanu vs. Zumock", aliases: ["keanu zumock", "keanu vs chad"] },
  { name: "Scarlett Drama", aliases: ["scarlett drama", "scarlett hampton drama"] },
  { name: "Dabbleverse Summit", aliases: ["dabbleverse summit", "mlc summit"] },
  { name: "Compound Media Drama", aliases: ["compound media", "compound drama"] },
  { name: "Lady K Investigations", aliases: ["lady k investigation", "lady k expose"] },
];

const shows = [
  { name: "Who Are These Podcasts", aliases: ["watp", "who are these podcasts", "karl's show"] },
  { name: "Steel Toe Morning Show", aliases: ["steel toe", "stms", "aaron's show"] },
  { name: "Misery Loves Company", aliases: ["mlc", "misery loves company"] },
  { name: "Shuli Network", aliases: ["shuli network", "shuli show"] },
  { name: "Opie Radio", aliases: ["opie radio", "opie show", "opie podcast"] },
  { name: "Compound Media", aliases: ["compound media", "anthony cumia show"] },
  { name: "Moist Cr1TiKaL", aliases: ["moist", "moistcritical", "penguinz0"] },
  { name: "Chrissie Mayr Podcast", aliases: ["chrissie mayr", "chrissie show"] },
  { name: "Kevin Brennan Show", aliases: ["kevin brennan show", "kb show"] },
  { name: "BYB Podcast", aliases: ["byb", "byb pod", "beyond your buzz"] },
];

async function seed() {
  console.log('🎬 Seeding storylines and shows...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    let storyCount = 0;
    let showCount = 0;
    
    // Insert storylines
    for (const story of storylines) {
      const result = await pool.query(
        `INSERT INTO entities (type, canonical_name, enabled) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (canonical_name) DO UPDATE SET enabled = true 
         RETURNING id`,
        ['storyline', story.name, true]
      );
      
      const entityId = result.rows[0].id;
      
      // Insert aliases
      for (const alias of story.aliases) {
        await pool.query(
          `INSERT INTO entity_aliases (entity_id, alias_text, match_type, platform_scope, confidence_weight) 
           VALUES ($1, $2, $3, $4, $5) 
           ON CONFLICT (entity_id, alias_text, platform_scope) DO NOTHING`,
          [entityId, alias, 'contains', 'any', 0.9]
        );
      }
      
      console.log(`  ✅ ${story.name}`);
      storyCount++;
    }
    
    // Insert shows
    for (const show of shows) {
      const result = await pool.query(
        `INSERT INTO entities (type, canonical_name, enabled) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (canonical_name) DO UPDATE SET enabled = true 
         RETURNING id`,
        ['show', show.name, true]
      );
      
      const entityId = result.rows[0].id;
      
      // Insert aliases
      for (const alias of show.aliases) {
        await pool.query(
          `INSERT INTO entity_aliases (entity_id, alias_text, match_type, platform_scope, confidence_weight) 
           VALUES ($1, $2, $3, $4, $5) 
           ON CONFLICT (entity_id, alias_text, platform_scope) DO NOTHING`,
          [entityId, alias, 'contains', 'any', 0.95]
        );
      }
      
      console.log(`  ✅ ${show.name}`);
      showCount++;
    }
    
    console.log(`\n✅ Seeded ${storyCount} storylines and ${showCount} shows`);
    
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

seed();
