#!/bin/bash
set -e

echo "🚀 Quick Database Setup"
echo ""

# Load env vars
export $(cat .env.local | grep -v "^#" | xargs)

# Create essential tables
psql "${DATABASE_URL}" << 'EOF'
-- Create enums first
DO $$ BEGIN
    CREATE TYPE tier AS ENUM ('clippers', 'weekly_wrap');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Source accounts
CREATE TABLE IF NOT EXISTS source_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'youtube',
  tier tier NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  handle TEXT,
  channel_id TEXT UNIQUE,
  display_name TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_resolved_at TIMESTAMPTZ,
  last_ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Items
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  tier tier,
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
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(platform, platform_item_id)
);

-- Item snapshots
CREATE TABLE IF NOT EXISTS item_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS item_metric_snapshots_item_captured_idx 
  ON item_metric_snapshots(item_id, captured_at DESC);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key VARCHAR(64) NOT NULL UNIQUE,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  primary_item_id UUID REFERENCES items(id),
  platform_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_title TEXT NOT NULL,
  event_summary TEXT,
  item_count INTEGER DEFAULT 1 NOT NULL,
  related_count INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS events_last_seen_at_idx ON events(last_seen_at);

-- Event items junction
CREATE TABLE IF NOT EXISTS event_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(event_id, item_id)
);

-- Feed cards
CREATE TABLE IF NOT EXISTS feed_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  primary_item_id UUID NOT NULL REFERENCES items(id),
  source TEXT NOT NULL,
  tier tier,
  title TEXT NOT NULL,
  meta TEXT NOT NULL,
  why TEXT NOT NULL,
  url TEXT NOT NULL,
  related_count INTEGER DEFAULT 1 NOT NULL,
  entity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(window, event_id)
);

CREATE INDEX IF NOT EXISTS feed_cards_window_computed_idx 
  ON feed_cards(window, computed_at DESC);

EOF

echo ""
echo "✅ Database tables created!"
echo ""
echo "📋 Next: Seed YouTube channels"
echo "   npm run seed:youtube"
