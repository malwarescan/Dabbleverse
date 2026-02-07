import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const { Pool } = pg;

async function seedEntities() {
  console.log('🎭 Seeding entities and aliases...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Load entities JSON
    const entitiesData = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../seed/entities/REAL_ENTITIES.json'), 'utf-8')
    );
    
    // Load aliases JSON
    const aliasesData = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../seed/entities/REAL_ALIASES.json'), 'utf-8')
    );
    
    console.log(`Found ${entitiesData.entities.length} entities and ${aliasesData.aliases.length} aliases\n`);
    
    // Insert entities
    const entityMap = new Map<string, string>(); // temp_id -> real UUID
    
    for (const entity of entitiesData.entities) {
      console.log(`  📝 Inserting: ${entity.canonical_name} (${entity.type})`);
      
      const result = await pool.query(
        `INSERT INTO entities (type, canonical_name, description, enabled) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (canonical_name) DO UPDATE SET description = $2 
         RETURNING id`,
        [entity.type, entity.canonical_name, entity.description || null, entity.enabled]
      );
      
      entityMap.set(entity.id, result.rows[0].id);
    }
    
    console.log(`\n✅ Inserted ${entityMap.size} entities`);
    
    // Insert aliases
    let aliasCount = 0;
    for (const alias of aliasesData.aliases) {
      const entityId = entityMap.get(alias.entity_id);
      if (!entityId) continue;
      
      await pool.query(
        `INSERT INTO entity_aliases (entity_id, alias_text, match_type, platform_scope, confidence_weight) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (entity_id, alias_text, platform_scope) DO NOTHING`,
        [entityId, alias.alias_text, alias.match_type, alias.platform_scope || 'any', alias.confidence_weight || 1.0]
      );
      
      aliasCount++;
    }
    
    console.log(`✅ Inserted ${aliasCount} aliases\n`);
    console.log('🎉 Entity seeding complete!');
    
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

seedEntities();
