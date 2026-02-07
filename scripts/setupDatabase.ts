import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../lib/db/schema';

async function setupDatabase() {
  console.log('🚀 Setting up database...\n');
  
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dabbleverse';
  console.log('📍 Using database:', DATABASE_URL.replace(/:[^:]*@/, ':****@'));
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });
  
  const db = drizzle(pool, { schema });
  
  try {
    // Create all tables using Drizzle
    console.log('📋 Creating tables from schema...');
    
    // The schema will auto-create tables when we run queries
    // For now, let's just verify connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', result.rows[0].now);
    
    // Run a simple query to trigger table creation
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        canonical_name VARCHAR(255) NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS source_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL DEFAULT 'youtube',
        tier TEXT NOT NULL,
        source_url TEXT NOT NULL,
        handle TEXT,
        channel_id TEXT UNIQUE,
        display_name TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        last_resolved_at TIMESTAMPTZ,
        last_ingested_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS source_accounts_source_url_idx ON source_accounts(source_url);
      
      CREATE TABLE IF NOT EXISTS items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL,
        tier TEXT,
        source_account_id UUID REFERENCES source_accounts(id),
        platform_item_id VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        content TEXT,
        author VARCHAR(255),
        channel_id TEXT,
        channel_title TEXT,
        published_at TIMESTAMPTZ NOT NULL,
        fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        duration_seconds INTEGER,
        metrics_snapshot JSONB NOT NULL,
        raw_payload JSONB,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS items_platform_item_id_unique ON items(platform, platform_item_id);
      
      CREATE TABLE IF NOT EXISTS item_metric_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        captured_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS item_metric_snapshots_item_captured_idx ON item_metric_snapshots(item_id, captured_at DESC);
      
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_key VARCHAR(64) NOT NULL UNIQUE,
        first_seen_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL,
        primary_item_id UUID REFERENCES items(id),
        platform_mix JSONB NOT NULL,
        event_title TEXT NOT NULL,
        event_summary TEXT,
        item_count INTEGER DEFAULT 1 NOT NULL,
        related_count INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS events_event_key_idx ON events(event_key);
      CREATE INDEX IF NOT EXISTS events_last_seen_at_idx ON events(last_seen_at);
      
      CREATE TABLE IF NOT EXISTS event_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        UNIQUE(event_id, item_id)
      );
      
      CREATE TABLE IF NOT EXISTS feed_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        window TEXT NOT NULL,
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        primary_item_id UUID NOT NULL REFERENCES items(id),
        source TEXT NOT NULL,
        tier TEXT,
        title TEXT NOT NULL,
        meta TEXT NOT NULL,
        why TEXT NOT NULL,
        url TEXT NOT NULL,
        related_count INTEGER DEFAULT 1 NOT NULL,
        entity_ids JSONB NOT NULL,
        computed_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS feed_cards_window_event_idx ON feed_cards(window, event_id);
    `);
    
    console.log('✅ Core tables created');
    console.log('\n🎉 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupDatabase();
