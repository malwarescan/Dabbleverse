#!/usr/bin/env npx tsx
/**
 * Creates youtube_comment_snippets and budding_storyline_signals tables if they don't exist.
 * Run once if db:push didn't apply (e.g. interactive prompt): npx tsx scripts/ensureBuddingTables.ts
 */
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  // Create "window" enum if not exists (idempotent; window is reserved in SQL)
  await db.execute(sql.raw(`
    DO $$ BEGIN
      CREATE TYPE "window" AS ENUM ('now', '24h', '7d');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS youtube_comment_snippets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      youtube_comment_id VARCHAR(255) NOT NULL,
      text TEXT NOT NULL,
      author_display_name VARCHAR(255),
      like_count INTEGER DEFAULT 0,
      published_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(item_id, youtube_comment_id)
    );
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS youtube_comment_snippets_item_id_idx ON youtube_comment_snippets(item_id);
    CREATE INDEX IF NOT EXISTS youtube_comment_snippets_published_at_idx ON youtube_comment_snippets(published_at);
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS budding_storyline_signals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      "window" "window" NOT NULL,
      mention_count INTEGER NOT NULL DEFAULT 0,
      comment_mentions INTEGER DEFAULT 0,
      description_mentions INTEGER DEFAULT 0,
      sample_snippets JSONB,
      computed_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS budding_storyline_signals_entity_window_idx ON budding_storyline_signals(entity_id, "window");
    CREATE INDEX IF NOT EXISTS budding_storyline_signals_computed_at_idx ON budding_storyline_signals(computed_at);
  `));

  // Add 'main' to tier enum if not present (for main character channels)
  try {
    await db.execute(sql.raw(`ALTER TYPE tier ADD VALUE 'main'`));
    console.log('  Added tier value: main');
  } catch (e: unknown) {
    if ((e as { code?: string })?.code !== '42701') throw e; // 42701 = duplicate enum value
  }

  console.log('✅ youtube_comment_snippets and budding_storyline_signals tables ready.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
