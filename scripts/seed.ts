import fs from 'fs';
import path from 'path';
import { db, entities, entityAliases, watchlists } from '@/lib/db';
import { eq } from 'drizzle-orm';

interface EntitySeed {
  id: string;
  type: 'character' | 'storyline' | 'show';
  canonical_name: string;
  description: string;
  enabled: boolean;
}

interface AliasSeed {
  entity_id: string;
  alias_text: string;
  match_type: 'exact' | 'contains' | 'regex' | 'handle';
  platform_scope: string;
  confidence_weight: number;
}

interface YouTubeChannelSeed {
  id: string;
  name: string;
  url: string;
  category: string;
  weight: number;
  enabled: boolean;
}

interface SubredditSeed {
  name: string;
  category: string;
  weight: number;
  enabled: boolean;
}

async function seedEntities() {
  const entitiesPath = path.join(process.cwd(), 'seed/entities/entities.json');
  const data = JSON.parse(fs.readFileSync(entitiesPath, 'utf-8'));

  console.log('Seeding entities...');

  for (const entity of data.entities as EntitySeed[]) {
    try {
      // Check if entity exists
      const existing = await db
        .select()
        .from(entities)
        .where(eq(entities.id, entity.id))
        .limit(1);

      if (existing.length > 0) {
        // Update
        await db
          .update(entities)
          .set({
            canonicalName: entity.canonical_name,
            description: entity.description,
            enabled: entity.enabled,
            type: entity.type,
            updatedAt: new Date(),
          })
          .where(eq(entities.id, entity.id));
        console.log(`  Updated entity: ${entity.canonical_name}`);
      } else {
        // Insert
        await db.insert(entities).values({
          id: entity.id,
          type: entity.type,
          canonicalName: entity.canonical_name,
          description: entity.description,
          enabled: entity.enabled,
        });
        console.log(`  Created entity: ${entity.canonical_name}`);
      }
    } catch (error) {
      console.error(`  Error seeding entity ${entity.id}:`, error);
    }
  }
}

async function seedAliases() {
  const aliasesPath = path.join(process.cwd(), 'seed/entities/aliases.json');
  const data = JSON.parse(fs.readFileSync(aliasesPath, 'utf-8'));

  console.log('Seeding aliases...');

  for (const alias of data.aliases as AliasSeed[]) {
    try {
      await db.insert(entityAliases).values({
        entityId: alias.entity_id,
        aliasText: alias.alias_text,
        matchType: alias.match_type,
        platformScope: alias.platform_scope,
        confidenceWeight: alias.confidence_weight,
      }).onConflictDoNothing();
      console.log(`  Added alias: ${alias.alias_text} -> ${alias.entity_id}`);
    } catch (error) {
      console.error(`  Error seeding alias ${alias.alias_text}:`, error);
    }
  }
}

async function seedYouTubeWatchlist() {
  const watchlistPath = path.join(process.cwd(), 'seed/watchlists/youtube.json');
  const data = JSON.parse(fs.readFileSync(watchlistPath, 'utf-8'));

  console.log('Seeding YouTube watchlist...');

  for (const channel of data.channels as YouTubeChannelSeed[]) {
    try {
      await db.insert(watchlists).values({
        platform: 'youtube',
        identifier: channel.id,
        name: channel.name,
        category: channel.category,
        weight: channel.weight,
        enabled: channel.enabled,
        metadata: { url: channel.url },
      }).onConflictDoUpdate({
        target: [watchlists.platform, watchlists.identifier],
        set: {
          name: channel.name,
          category: channel.category,
          weight: channel.weight,
          enabled: channel.enabled,
          updatedAt: new Date(),
        },
      });
      console.log(`  Added/Updated YouTube channel: ${channel.name}`);
    } catch (error) {
      console.error(`  Error seeding YouTube channel ${channel.name}:`, error);
    }
  }
}

async function seedRedditWatchlist() {
  const watchlistPath = path.join(process.cwd(), 'seed/watchlists/reddit.json');
  const data = JSON.parse(fs.readFileSync(watchlistPath, 'utf-8'));

  console.log('Seeding Reddit watchlist...');

  for (const subreddit of data.subreddits as SubredditSeed[]) {
    try {
      await db.insert(watchlists).values({
        platform: 'reddit',
        identifier: subreddit.name,
        name: `r/${subreddit.name}`,
        category: subreddit.category,
        weight: subreddit.weight,
        enabled: subreddit.enabled,
      }).onConflictDoUpdate({
        target: [watchlists.platform, watchlists.identifier],
        set: {
          name: `r/${subreddit.name}`,
          category: subreddit.category,
          weight: subreddit.weight,
          enabled: subreddit.enabled,
          updatedAt: new Date(),
        },
      });
      console.log(`  Added/Updated subreddit: r/${subreddit.name}`);
    } catch (error) {
      console.error(`  Error seeding subreddit ${subreddit.name}:`, error);
    }
  }
}

async function main() {
  console.log('Starting database seed...');

  try {
    await seedEntities();
    await seedAliases();
    await seedYouTubeWatchlist();
    await seedRedditWatchlist();

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

main();
