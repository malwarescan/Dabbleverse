import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { db } from '../lib/db/index';
import { entities, entityAliases } from '../lib/db/schema';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function seedEntities() {
  console.log('🎭 Seeding entities and aliases...\n');
  
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
      
      const [inserted] = await db.insert(entities)
        .values({
          type: entity.type,
          canonicalName: entity.canonical_name,
          description: entity.description || null,
          enabled: entity.enabled,
        })
        .onConflictDoNothing()
        .returning();
      
      if (inserted) {
        entityMap.set(entity.id, inserted.id);
      }
    }
    
    console.log(`\n✅ Inserted ${entityMap.size} entities`);
    
    // Insert aliases
    let aliasCount = 0;
    for (const alias of aliasesData.aliases) {
      const entityId = entityMap.get(alias.entity_id);
      if (!entityId) continue;
      
      await db.insert(entityAliases)
        .values({
          entityId,
          aliasText: alias.alias_text,
          matchType: alias.match_type as 'exact' | 'contains' | 'regex' | 'handle',
          platformScope: alias.platform_scope || 'any',
          confidenceWeight: alias.confidence_weight || 1.0,
        })
        .onConflictDoNothing();
      
      aliasCount++;
    }
    
    console.log(`✅ Inserted ${aliasCount} aliases\n`);
    console.log('🎉 Entity seeding complete!');
    
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
  }
  
  process.exit(0);
}

seedEntities();
