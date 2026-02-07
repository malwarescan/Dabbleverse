import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const { Pool } = pg;

// Updated storylines based on ACTUAL video titles
const storylines = [
  { 
    name: "Keanu vs Zumock Drama", 
    aliases: ["keanu", "zumock", "keanu vs chad", "keanu zumock", "keanu c thompson"] 
  },
  { 
    name: "Opie vs Anthony Feud", 
    aliases: ["opie anthony", "opie cumia", "opie vs anthony", "opie reads anthony"] 
  },
  { 
    name: "Steel Toe Financial Crisis", 
    aliases: ["steel toe", "aaron", "stms", "steel toe morning"] 
  },
  { 
    name: "Scarlett Hampton Saga", 
    aliases: ["scarlett hampton", "scarlett", "geno scarlett", "ralph scarlett"] 
  },
  { 
    name: "Rekieta Network Drama", 
    aliases: ["rekieta", "nick rekieta", "kyle rittenhouse"] 
  },
  { 
    name: "Stuttering John Meltdowns", 
    aliases: ["stuttering john", "john melendez", "sj crashes", "john vs"] 
  },
  { 
    name: "MLC vs Everyone", 
    aliases: ["mlc", "misery loves company", "mlc podcast"] 
  },
];

async function update() {
  console.log('🔄 Updating storylines with real matches...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // First, delete old storyline aliases
    await pool.query(`DELETE FROM entity_aliases WHERE entity_id IN (SELECT id FROM entities WHERE type = 'storyline')`);
    await pool.query(`DELETE FROM entities WHERE type = 'storyline'`);
    
    let count = 0;
    
    // Insert updated storylines
    for (const story of storylines) {
      const result = await pool.query(
        `INSERT INTO entities (type, canonical_name, enabled) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        ['storyline', story.name, true]
      );
      
      const entityId = result.rows[0].id;
      
      // Insert aliases
      for (const alias of story.aliases) {
        await pool.query(
          `INSERT INTO entity_aliases (entity_id, alias_text, match_type, platform_scope, confidence_weight) 
           VALUES ($1, $2, $3, $4, $5)`,
          [entityId, alias.toLowerCase(), 'contains', 'any', 0.95]
        );
      }
      
      console.log(`  ✅ ${story.name} (${story.aliases.length} aliases)`);
      count++;
    }
    
    console.log(`\n✅ Updated ${count} storylines`);
    
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

update();
