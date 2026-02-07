# 🎬 YouTube Ingestion Pipeline - Implementation Spec

**Status:** Ready to implement  
**Owner:** Full team (divided by specialty)  
**Timeline:** 5-7 days  
**Goal:** Replace mock data with real YouTube ingestion + dedup + scoring

---

## 📋 Team Ownership Map

### 🔧 **Data Engineer** - Pipeline & Algorithm Owner
**Your Domain:** Everything that touches data transformation
- Database schema implementation (7 tables)
- YouTube API integration (`lib/ingestion/youtube.ts` enhancement)
- Dedup algorithm (`lib/scoring/deduplication.ts` enhancement)
- Feed card generation logic
- Scoring computation
- Query optimization

---

### 🚀 **Ship Captain** - Infrastructure & Orchestration Owner
**Your Domain:** Everything that makes it run and deploy
- BullMQ queue setup (4 queues)
- Worker service jobs (resolve, pull, refresh, dedupe, score, feed)
- API endpoints (scoreboard, feed)
- Railway configuration (worker + web services)
- Environment variables + secrets
- Health checks + monitoring

---

### 🎨 **UX Lead** - Data Display Owner
**Your Domain:** Everything the user sees
- Tier badges ("CLIP", "WEEKLY")
- Related count indicators ("1 event, 6 related posts")
- Receipt modal (shows primary + related items)
- Source pills (dynamic - only show active sources)
- Computed timestamp display
- Feed card enhancements

---

## 🗄️ Database Schema (Data Engineer Owns)

### New Tables to Create

#### 1. `source_accounts` - YouTube Channels We Watch

```sql
CREATE TABLE source_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'youtube',
  tier TEXT NOT NULL CHECK (tier IN ('clippers', 'weekly_wrap')),
  source_url TEXT NOT NULL,
  handle TEXT,
  channel_id TEXT UNIQUE,
  display_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_resolved_at TIMESTAMPTZ,
  last_ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_source_accounts_platform_channel 
  ON source_accounts(platform, channel_id);
CREATE INDEX idx_source_accounts_tier_active 
  ON source_accounts(tier, is_active) WHERE is_active = true;
```

**Drizzle Schema:**
```typescript
export const sourceAccounts = pgTable('source_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: text('platform').notNull().default('youtube'),
  tier: text('tier', { enum: ['clippers', 'weekly_wrap'] }).notNull(),
  sourceUrl: text('source_url').notNull(),
  handle: text('handle'),
  channelId: text('channel_id').unique(),
  displayName: text('display_name'),
  isActive: boolean('is_active').default(true),
  lastResolvedAt: timestamp('last_resolved_at', { withTimezone: true }),
  lastIngestedAt: timestamp('last_ingested_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  platformChannelIdx: uniqueIndex('idx_source_accounts_platform_channel')
    .on(table.platform, table.channelId),
  tierActiveIdx: index('idx_source_accounts_tier_active')
    .on(table.tier, table.isActive),
}));
```

---

#### 2. `item_metric_snapshots` - Time Series Stats

```sql
CREATE TABLE item_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0
);

CREATE INDEX idx_item_metric_snapshots_item_captured 
  ON item_metric_snapshots(item_id, captured_at DESC);
```

**Drizzle Schema:**
```typescript
export const itemMetricSnapshots = pgTable('item_metric_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow(),
  views: bigint('views', { mode: 'number' }).default(0),
  likes: bigint('likes', { mode: 'number' }).default(0),
  comments: bigint('comments', { mode: 'number' }).default(0),
}, (table) => ({
  itemCapturedIdx: index('idx_item_metric_snapshots_item_captured')
    .on(table.itemId, table.capturedAt),
}));
```

---

#### 3. Update `items` Table - Add Tier + Source Account

```typescript
// Add to existing items table
export const items = pgTable('items', {
  // ... existing fields ...
  tier: text('tier', { enum: ['clippers', 'weekly_wrap'] }),
  sourceAccountId: uuid('source_account_id').references(() => sourceAccounts.id),
  durationSeconds: integer('duration_seconds'),
  // ... rest of fields
});
```

---

#### 4. Update `events` Table - Add Platform Mix

```typescript
export const events = pgTable('events', {
  // ... existing fields ...
  platformMix: jsonb('platform_mix').$type<{youtube: boolean, reddit: boolean}>(),
  relatedCount: integer('related_count').default(0),
  // ... rest of fields
});
```

---

#### 5. `event_items` Join Table (Already Exists as `eventItems`)

✅ Already in schema - no changes needed

---

#### 6. Update `feedCards` Table - Add Tier + Related Count

```typescript
export const feedCards = pgTable('feed_cards', {
  // ... existing fields ...
  tier: text('tier', { enum: ['clippers', 'weekly_wrap'] }),
  relatedCount: integer('related_count').default(1),
  // ... rest of fields
});
```

---

#### 7. Rename `scores` → `score_snapshots` (Optional, or keep as is)

Current table `scores` matches the spec's `score_snapshots` - keep as is.

---

## 📦 Seed Data (Data Engineer Creates)

**File:** `seed/watchlists/youtube.json`

```json
{
  "tiers": {
    "clippers": [
      "https://www.youtube.com/@SoThoroughJoeBurrow",
      "https://www.youtube.com/@DOOMSPAYUH",
      "https://www.youtube.com/@Stallyn19",
      "https://www.youtube.com/@DURTYJERZEYRRAT",
      "https://www.youtube.com/@Wil_Herren",
      "https://www.youtube.com/@PEST__"
    ],
    "weekly_wrap": [
      "https://www.youtube.com/@BYB_POD",
      "https://www.youtube.com/@PovosClownTown",
      "https://www.youtube.com/@NJRanger201"
    ]
  }
}
```

**Seed Script:** `scripts/seedYouTubeWatchlist.ts`

```typescript
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { sourceAccounts } from '@/lib/db/schema';

async function seedWatchlist() {
  const watchlistPath = path.join(process.cwd(), 'seed/watchlists/youtube.json');
  const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf-8'));

  for (const [tier, urls] of Object.entries(watchlist.tiers)) {
    for (const url of urls as string[]) {
      const handle = url.match(/@([^/]+)/)?.[1];
      
      await db.insert(sourceAccounts)
        .values({
          platform: 'youtube',
          tier: tier as 'clippers' | 'weekly_wrap',
          sourceUrl: url,
          handle: handle,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [sourceAccounts.sourceUrl],
          set: {
            tier: tier as 'clippers' | 'weekly_wrap',
            isActive: true,
            updatedAt: new Date(),
          },
        });
      
      console.log(`✓ Seeded ${tier}: ${handle}`);
    }
  }
  
  console.log('✅ YouTube watchlist seeded!');
}

seedWatchlist();
```

---

## 🔄 BullMQ Jobs (Ship Captain Owns)

### Queue Definitions

**File:** `lib/jobs/youtubeQueue.ts`

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from '@/lib/utils/redis';

export const youtubeQueue = new Queue('youtube', { connection: redisConnection });
export const dedupeQueue = new Queue('dedupe', { connection: redisConnection });
export const scoreQueue = new Queue('score', { connection: redisConnection });
export const feedQueue = new Queue('feed', { connection: redisConnection });

// Schedule recurring jobs
export async function scheduleYouTubeJobs() {
  // Resolve channels (once on startup)
  await youtubeQueue.add('resolve_channels', {}, { 
    jobId: 'resolve_channels_once',
    removeOnComplete: true 
  });
  
  // Pull uploads - clippers (every 10 minutes)
  await youtubeQueue.add('pull_uploads', { tier: 'clippers' }, {
    repeat: { pattern: '*/10 * * * *' }, // Every 10 min
    jobId: 'pull_uploads_clippers',
  });
  
  // Pull uploads - weekly_wrap (every 30 minutes)
  await youtubeQueue.add('pull_uploads', { tier: 'weekly_wrap' }, {
    repeat: { pattern: '*/30 * * * *' }, // Every 30 min
    jobId: 'pull_uploads_weekly',
  });
  
  // Refresh stats (every 15 minutes)
  await youtubeQueue.add('refresh_stats', {}, {
    repeat: { pattern: '*/15 * * * *' },
    jobId: 'refresh_stats',
  });
  
  // Dedupe events (every 10 minutes)
  await dedupeQueue.add('dedupe_events', {}, {
    repeat: { pattern: '*/10 * * * *' },
    jobId: 'dedupe_events',
  });
  
  // Build feed cards (every 5 minutes)
  await feedQueue.add('build_feed_cards', {}, {
    repeat: { pattern: '*/5 * * * *' },
    jobId: 'build_feed_cards',
  });
  
  console.log('✅ YouTube jobs scheduled');
}
```

---

### Job 1: Resolve Channels (Data Engineer Implements)

**File:** `lib/jobs/processors/resolveChannels.ts`

```typescript
import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { sourceAccounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

export async function resolveChannels(job: Job) {
  // Get all unresolved channels (no channel_id yet)
  const unresolved = await db.query.sourceAccounts.findMany({
    where: and(
      eq(sourceAccounts.platform, 'youtube'),
      eq(sourceAccounts.channelId, null)
    ),
  });
  
  for (const account of unresolved) {
    if (!account.handle) continue;
    
    try {
      // Search for channel by handle
      const response = await youtube.search.list({
        part: ['snippet'],
        type: ['channel'],
        q: account.handle,
        maxResults: 5,
      });
      
      const channels = response.data.items || [];
      
      // Pick best match (first result that contains handle in title)
      const match = channels.find(ch => 
        ch.snippet?.channelTitle?.toLowerCase().includes(account.handle!.toLowerCase())
      ) || channels[0];
      
      if (match && match.snippet?.channelId) {
        await db.update(sourceAccounts)
          .set({
            channelId: match.snippet.channelId,
            displayName: match.snippet.channelTitle,
            lastResolvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(sourceAccounts.id, account.id));
        
        console.log(`✓ Resolved ${account.handle} → ${match.snippet.channelId}`);
      }
    } catch (error) {
      console.error(`✗ Failed to resolve ${account.handle}:`, error);
    }
  }
  
  return { resolved: unresolved.length };
}
```

---

### Job 2: Pull Uploads (Data Engineer Implements)

**File:** `lib/jobs/processors/pullUploads.ts`

```typescript
import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { sourceAccounts, items, itemMetricSnapshots } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const MAX_UPLOADS_PER_CHANNEL = parseInt(process.env.YOUTUBE_MAX_UPLOADS_PER_CHANNEL || '25');

export async function pullUploads(job: Job) {
  const { tier } = job.data;
  
  // Get active channels for this tier
  const channels = await db.query.sourceAccounts.findMany({
    where: and(
      eq(sourceAccounts.platform, 'youtube'),
      eq(sourceAccounts.tier, tier),
      eq(sourceAccounts.isActive, true)
    ),
  });
  
  let totalIngested = 0;
  
  for (const channel of channels) {
    if (!channel.channelId) continue;
    
    try {
      // Get uploads playlist ID
      const channelResponse = await youtube.channels.list({
        part: ['contentDetails'],
        id: [channel.channelId],
      });
      
      const uploadsPlaylistId = 
        channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      
      if (!uploadsPlaylistId) continue;
      
      // Get latest videos from playlist
      const playlistResponse = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: MAX_UPLOADS_PER_CHANNEL,
      });
      
      const videoIds = playlistResponse.data.items?.map(
        item => item.contentDetails?.videoId
      ).filter(Boolean) as string[];
      
      if (videoIds.length === 0) continue;
      
      // Get full video details + stats
      const videosResponse = await youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: videoIds,
      });
      
      // Upsert each video
      for (const video of videosResponse.data.items || []) {
        const videoId = video.id!;
        const snippet = video.snippet!;
        const stats = video.statistics!;
        
        // Parse duration (ISO 8601 format PT1H2M3S)
        const durationMatch = video.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const durationSeconds = durationMatch 
          ? (parseInt(durationMatch[1] || '0') * 3600) +
            (parseInt(durationMatch[2] || '0') * 60) +
            (parseInt(durationMatch[3] || '0'))
          : null;
        
        // Upsert item
        const [item] = await db.insert(items)
          .values({
            platform: 'youtube',
            tier: channel.tier,
            sourceAccountId: channel.id,
            platformItemId: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: snippet.title!,
            description: snippet.description || '',
            channelId: snippet.channelId!,
            channelTitle: snippet.channelTitle!,
            publishedAt: new Date(snippet.publishedAt!),
            fetchedAt: new Date(),
            durationSeconds,
            raw: video as any,
          })
          .onConflictDoUpdate({
            target: [items.platform, items.platformItemId],
            set: {
              title: snippet.title!,
              description: snippet.description || '',
              fetchedAt: new Date(),
              durationSeconds,
              raw: video as any,
            },
          })
          .returning();
        
        // Insert metric snapshot
        await db.insert(itemMetricSnapshots)
          .values({
            itemId: item.id,
            capturedAt: new Date(),
            views: parseInt(stats.viewCount || '0'),
            likes: parseInt(stats.likeCount || '0'),
            comments: parseInt(stats.commentCount || '0'),
          })
          .onConflictDoNothing(); // Avoid duplicate snapshots
        
        totalIngested++;
      }
      
      // Update channel's last_ingested_at
      await db.update(sourceAccounts)
        .set({ lastIngestedAt: new Date() })
        .where(eq(sourceAccounts.id, channel.id));
      
      console.log(`✓ Ingested ${videoIds.length} videos from ${channel.displayName}`);
      
    } catch (error) {
      console.error(`✗ Failed to ingest ${channel.displayName}:`, error);
    }
  }
  
  return { tier, totalIngested };
}
```

---

### Job 3: Refresh Stats (Data Engineer Implements)

**File:** `lib/jobs/processors/refreshStats.ts`

```typescript
import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { items, itemMetricSnapshots } from '@/lib/db/schema';
import { gte, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const LOOKBACK_HOURS = parseInt(process.env.YOUTUBE_STATS_REFRESH_LOOKBACK_HOURS || '48');

export async function refreshStats(job: Job) {
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
  
  // Get recent items
  const recentItems = await db.query.items.findMany({
    where: and(
      eq(items.platform, 'youtube'),
      gte(items.publishedAt, cutoff)
    ),
    columns: {
      id: true,
      platformItemId: true,
    },
  });
  
  // Batch into groups of 50 (YouTube API limit)
  const batches = [];
  for (let i = 0; i < recentItems.length; i += 50) {
    batches.push(recentItems.slice(i, i + 50));
  }
  
  let totalRefreshed = 0;
  
  for (const batch of batches) {
    const videoIds = batch.map(item => item.platformItemId);
    
    try {
      const response = await youtube.videos.list({
        part: ['statistics'],
        id: videoIds,
      });
      
      for (const video of response.data.items || []) {
        const videoId = video.id!;
        const stats = video.statistics!;
        const item = batch.find(i => i.platformItemId === videoId);
        
        if (!item) continue;
        
        // Insert new snapshot
        await db.insert(itemMetricSnapshots)
          .values({
            itemId: item.id,
            capturedAt: new Date(),
            views: parseInt(stats.viewCount || '0'),
            likes: parseInt(stats.likeCount || '0'),
            comments: parseInt(stats.commentCount || '0'),
          });
        
        totalRefreshed++;
      }
      
    } catch (error) {
      console.error('✗ Failed to refresh stats batch:', error);
    }
  }
  
  return { totalRefreshed };
}
```

---

## 🔗 Dedup Pipeline (Data Engineer Owns)

### Enhanced Dedup Algorithm

**File:** `lib/scoring/deduplication.ts` (UPDATE EXISTING)

```typescript
import { db } from '@/lib/db';
import { items, events, eventItems } from '@/lib/db/schema';
import { gte, eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

const STOPWORDS = new Set([
  'dabbleverse', 'dabble', 'clip', 'clips', 'reaction', 'reactions',
  'highlights', 'live', 'stream', 'streams', 'podcast', 'podcasts',
  'show', 'shows', 'episode', 'episodes'
]);

const JACCARD_THRESHOLD = 0.55;
const TIME_BUCKET_HOURS = 6;

function normalizeTitle(title: string, channelTitle: string): string[] {
  // Lowercase + remove punctuation
  let normalized = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove channel name tokens
  const channelTokens = channelTitle.toLowerCase().split(/\s+/);
  channelTokens.forEach(token => {
    normalized = normalized.replace(new RegExp(`\\b${token}\\b`, 'g'), '');
  });
  
  // Tokenize and filter
  const tokens = normalized.split(/\s+/)
    .filter(token => token.length >= 3)
    .filter(token => !STOPWORDS.has(token));
  
  return tokens;
}

function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

function getTimeBucket(date: Date): string {
  const hours = Math.floor(date.getTime() / (1000 * 60 * 60));
  const bucket = Math.floor(hours / TIME_BUCKET_HOURS) * TIME_BUCKET_HOURS;
  return new Date(bucket * 60 * 60 * 1000).toISOString();
}

function generateEventKey(tokens: string[], timeBucket: string): string {
  const topTokens = tokens.slice(0, 8).sort().join('_');
  const keyInput = `${timeBucket}|${topTokens}`;
  return 'yt:' + crypto.createHash('sha1').update(keyInput).digest('hex').substring(0, 16);
}

export async function deduplicateYouTubeItems() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // Last 48h
  
  // Get recent clipper items
  const recentItems = await db.query.items.findMany({
    where: and(
      eq(items.platform, 'youtube'),
      eq(items.tier, 'clippers'),
      gte(items.publishedAt, cutoff)
    ),
    orderBy: desc(items.publishedAt),
  });
  
  console.log(`Processing ${recentItems.length} recent clipper items...`);
  
  for (const item of recentItems) {
    // Normalize title into tokens
    const tokens = normalizeTitle(item.title, item.channelTitle);
    if (tokens.length === 0) continue;
    
    const timeBucket = getTimeBucket(item.publishedAt);
    const tokenSet = new Set(tokens);
    
    // Check for existing events in same time bucket
    const candidateEvents = await db.query.events.findMany({
      where: gte(events.firstSeenAt, new Date(Date.now() - 12 * 60 * 60 * 1000)), // 12h window
      with: {
        items: {
          with: { item: true }
        }
      },
      limit: 100,
    });
    
    let matchedEvent = null;
    let bestSimilarity = 0;
    
    for (const event of candidateEvents) {
      // Get primary item for this event
      const primaryItem = event.items.find(ei => ei.itemId === event.primaryItemId)?.item;
      if (!primaryItem) continue;
      
      const eventTokens = normalizeTitle(primaryItem.title, primaryItem.channelTitle);
      const eventTokenSet = new Set(eventTokens);
      
      const similarity = jaccardSimilarity(tokenSet, eventTokenSet);
      
      if (similarity >= JACCARD_THRESHOLD && similarity > bestSimilarity) {
        matchedEvent = event;
        bestSimilarity = similarity;
      }
    }
    
    if (matchedEvent) {
      // Attach to existing event
      await db.insert(eventItems)
        .values({
          eventId: matchedEvent.id,
          itemId: item.id,
        })
        .onConflictDoNothing();
      
      // Update event's last_seen_at + related_count
      await db.update(events)
        .set({
          lastSeenAt: new Date(),
          relatedCount: db.select({ count: sql`COUNT(*)` })
            .from(eventItems)
            .where(eq(eventItems.eventId, matchedEvent.id)),
        })
        .where(eq(events.id, matchedEvent.id));
      
      console.log(`✓ Attached item to event ${matchedEvent.eventKey} (similarity: ${bestSimilarity.toFixed(2)})`);
      
    } else {
      // Create new event
      const eventKey = generateEventKey(tokens, timeBucket);
      
      const [newEvent] = await db.insert(events)
        .values({
          eventKey,
          eventTitle: item.title,
          firstSeenAt: item.publishedAt,
          lastSeenAt: item.publishedAt,
          primaryItemId: item.id,
          platformMix: { youtube: true, reddit: false },
          relatedCount: 1,
        })
        .onConflictDoNothing()
        .returning();
      
      if (newEvent) {
        await db.insert(eventItems)
          .values({
            eventId: newEvent.id,
            itemId: item.id,
          });
        
        console.log(`✓ Created new event ${eventKey} for: ${item.title.substring(0, 50)}...`);
      }
    }
  }
  
  // Update primary items (choose highest velocity)
  await updatePrimaryItems();
  
  return { processed: recentItems.length };
}

async function updatePrimaryItems() {
  // For each event, recalculate primary item based on velocity
  const allEvents = await db.query.events.findMany({
    with: {
      items: {
        with: { item: true }
      }
    }
  });
  
  for (const event of allEvents) {
    let bestItem = null;
    let bestVelocity = 0;
    
    for (const { item } of event.items) {
      // Get last two snapshots
      const snapshots = await db.query.itemMetricSnapshots.findMany({
        where: eq(itemMetricSnapshots.itemId, item.id),
        orderBy: desc(itemMetricSnapshots.capturedAt),
        limit: 2,
      });
      
      let velocity = 0;
      if (snapshots.length === 2) {
        const timeDiff = (snapshots[0].capturedAt.getTime() - snapshots[1].capturedAt.getTime()) / 60000; // minutes
        const viewDiff = snapshots[0].views - snapshots[1].views;
        velocity = timeDiff > 0 ? viewDiff / timeDiff : 0;
      } else if (snapshots.length === 1) {
        velocity = snapshots[0].views; // Fallback to total views
      }
      
      if (velocity > bestVelocity) {
        bestVelocity = velocity;
        bestItem = item;
      }
    }
    
    if (bestItem && bestItem.id !== event.primaryItemId) {
      await db.update(events)
        .set({ 
          primaryItemId: bestItem.id,
          eventTitle: bestItem.title,
        })
        .where(eq(events.id, event.id));
    }
  }
}
```

---

## 🎴 Feed Card Generation (Data Engineer Owns)

**File:** `lib/jobs/processors/buildFeedCards.ts`

```typescript
import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { events, feedCards, items } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { formatDistanceToNow } from 'date-fns';

const WINDOWS = ['now', '24h', '7d'] as const;

export async function buildFeedCards(job: Job) {
  for (const window of WINDOWS) {
    // Get newest events
    const recentEvents = await db.query.events.findMany({
      orderBy: desc(events.lastSeenAt),
      limit: 50,
      with: {
        primaryItem: true,
      },
    });
    
    for (const event of recentEvents) {
      if (!event.primaryItem) continue;
      
      const item = event.primaryItem;
      
      // Determine "why it matters"
      let why = '';
      if (item.tier === 'clippers') {
        // Check velocity (simplified for now)
        if (event.relatedCount >= 5) {
          why = 'Clip spike driving momentum.';
        } else {
          why = 'New clip gaining traction.';
        }
      } else if (item.tier === 'weekly_wrap') {
        why = 'Weekly recap consolidating the storyline.';
      }
      
      // Upsert feed card
      await db.insert(feedCards)
        .values({
          window,
          eventId: event.id,
          primaryItemId: item.id,
          tier: item.tier,
          source: 'youtube',
          title: item.title,
          meta: `${item.channelTitle} • ${formatDistanceToNow(item.publishedAt, { addSuffix: true })}`,
          why,
          url: item.url,
          relatedCount: event.relatedCount,
          computedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [feedCards.window, feedCards.eventId],
          set: {
            title: item.title,
            meta: `${item.channelTitle} • ${formatDistanceToNow(item.publishedAt, { addSuffix: true })}`,
            relatedCount: event.relatedCount,
            computedAt: new Date(),
          },
        });
    }
    
    console.log(`✓ Built feed cards for window: ${window}`);
  }
  
  return { windows: WINDOWS.length };
}
```

---

## 🚀 Worker Service (Ship Captain Owns)

**File:** `workers/youtubeWorker.ts` (NEW)

```typescript
import { Worker } from 'bullmq';
import { redisConnection } from '@/lib/utils/redis';
import { resolveChannels } from '@/lib/jobs/processors/resolveChannels';
import { pullUploads } from '@/lib/jobs/processors/pullUploads';
import { refreshStats } from '@/lib/jobs/processors/refreshStats';
import { deduplicateYouTubeItems } from '@/lib/scoring/deduplication';
import { buildFeedCards } from '@/lib/jobs/processors/buildFeedCards';

// YouTube worker
const youtubeWorker = new Worker('youtube', async (job) => {
  console.log(`[YouTube Worker] Processing job: ${job.name}`);
  
  switch (job.name) {
    case 'resolve_channels':
      return await resolveChannels(job);
    case 'pull_uploads':
      return await pullUploads(job);
    case 'refresh_stats':
      return await refreshStats(job);
    default:
      throw new Error(`Unknown job: ${job.name}`);
  }
}, { connection: redisConnection });

// Dedupe worker
const dedupeWorker = new Worker('dedupe', async (job) => {
  console.log(`[Dedupe Worker] Processing job: ${job.name}`);
  
  if (job.name === 'dedupe_events') {
    return await deduplicateYouTubeItems();
  }
}, { connection: redisConnection });

// Feed worker
const feedWorker = new Worker('feed', async (job) => {
  console.log(`[Feed Worker] Processing job: ${job.name}`);
  
  if (job.name === 'build_feed_cards') {
    return await buildFeedCards(job);
  }
}, { connection: redisConnection });

// Error handling
[youtubeWorker, dedupeWorker, feedWorker].forEach(worker => {
  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err);
  });
});

console.log('🚀 YouTube workers started');
```

**Update:** `workers/index.ts`

```typescript
// Add to existing workers
import './youtubeWorker';
```

---

## 🌐 API Endpoints (Ship Captain Owns)

### Enhanced Scoreboard API

**File:** `app/api/scoreboard/route.ts` (UPDATE)

```typescript
// Replace mock data with real query
import { getScoreboardRows } from '@/lib/utils/queries';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get('window') as WindowType || 'now';
  
  const cacheKey = `scoreboard:${window}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return NextResponse.json({
      window,
      computed_at: cached.computed_at,
      rows: cached.rows,
    });
  }
  
  // REAL DATA NOW
  const rows = await getScoreboardRows(window);
  
  const response = {
    window,
    computed_at: new Date().toISOString(),
    rows: rows.map(row => ({
      rank: row.rank,
      delta_rank: row.rankChange,
      entity: {
        id: row.entityId,
        name: row.entityName,
        type: row.entityType,
      },
      score: row.score,
      momentum_pct: row.momentum,
      sources: row.sources,
      driver: row.driver,
    })),
  };
  
  await setCache(cacheKey, response, 60);
  
  return NextResponse.json(response);
}
```

---

### Enhanced Feed API

**File:** `app/api/feed/route.ts` (UPDATE)

```typescript
import { db } from '@/lib/db';
import { feedCards } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get('window') as WindowType || 'now';
  const limit = parseInt(searchParams.get('limit') || '20');
  
  const cacheKey = `feed:${window}:${limit}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }
  
  // REAL DATA NOW
  const cards = await db.query.feedCards.findMany({
    where: eq(feedCards.window, window),
    orderBy: desc(feedCards.computedAt),
    limit,
  });
  
  const response = {
    window,
    computed_at: cards[0]?.computedAt.toISOString() || new Date().toISOString(),
    cards: cards.map(card => ({
      id: card.id,
      source: card.source,
      tier: card.tier,
      title: card.title,
      meta: card.meta,
      why: card.why,
      url: card.url,
      related_count: card.relatedCount,
    })),
  };
  
  await setCache(cacheKey, response, 30); // 30s cache for feed
  
  return NextResponse.json(response);
}
```

---

## 🎨 UI Enhancements (UX Lead Owns)

### 1. Tier Badges

**File:** `components/ui/TierBadge.tsx` (NEW)

```typescript
interface TierBadgeProps {
  tier: 'clippers' | 'weekly_wrap';
}

export function TierBadge({ tier }: TierBadgeProps) {
  const label = tier === 'clippers' ? 'CLIP' : 'WEEKLY';
  const colors = tier === 'clippers' 
    ? { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' }
    : { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' };
  
  return (
    <span
      className="px-2 py-1 text-xs font-bold rounded uppercase"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {label}
    </span>
  );
}
```

---

### 2. Related Count Indicator

**File:** `components/ui/RelatedCount.tsx` (NEW)

```typescript
interface RelatedCountProps {
  count: number;
}

export function RelatedCount({ count }: RelatedCountProps) {
  if (count <= 1) return null;
  
  return (
    <div
      className="text-xs font-semibold"
      style={{ color: 'var(--color-broadcast-accent)' }}
    >
      1 event • {count} related posts
    </div>
  );
}
```

---

### 3. Enhanced Feed Card

**File:** `components/ticker/TickerCard.tsx` (UPDATE)

```typescript
import { TierBadge } from '@/components/ui/TierBadge';
import { RelatedCount } from '@/components/ui/RelatedCount';

interface TickerCardProps {
  card: {
    tier: 'clippers' | 'weekly_wrap';
    title: string;
    meta: string;
    why: string;
    relatedCount: number;
  };
}

export function TickerCard({ card }: TickerCardProps) {
  return (
    <div className="p-4 space-y-2">
      <TierBadge tier={card.tier} />
      
      <div className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
        {card.title}
      </div>
      
      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {card.meta}
      </div>
      
      {card.why && (
        <div className="text-xs italic" style={{ color: 'var(--color-text-tertiary)' }}>
          {card.why}
        </div>
      )}
      
      <RelatedCount count={card.relatedCount} />
    </div>
  );
}
```

---

### 4. Source Pills - Dynamic Display

**File:** `components/ui/SourcePills.tsx` (UPDATE)

```typescript
export function SourcePills({ sources }: { sources: Record<string, number> }) {
  // Only show sources that are actually active (ingested)
  const activeSources = Object.entries(sources)
    .filter(([platform, value]) => {
      // Hide X until Phase 3
      if (platform === 'x') return false;
      // Hide Reddit until ingested
      if (platform === 'reddit' && value === 0) return false;
      return value > 0;
    });
  
  if (activeSources.length === 0) return null;
  
  return (
    <div className="flex gap-2">
      {activeSources.map(([platform, value]) => (
        <SourceBadge key={platform} platform={platform} />
      ))}
    </div>
  );
}
```

---

### 5. Computed Timestamp Display

**File:** `components/ui/ComputedTimestamp.tsx` (NEW)

```typescript
import { formatDistanceToNow } from 'date-fns';

interface ComputedTimestampProps {
  timestamp: string | Date;
}

export function ComputedTimestamp({ timestamp }: ComputedTimestampProps) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  return (
    <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
      Updated {formatDistanceToNow(date, { addSuffix: true })}
    </div>
  );
}
```

**Add to Masthead:**

```typescript
// In Masthead.tsx
import { ComputedTimestamp } from '@/components/ui/ComputedTimestamp';

<ComputedTimestamp timestamp={lastComputedAt} />
```

---

## ⚙️ Environment Variables (Ship Captain Adds)

**File:** `.env.local` (UPDATE)

```bash
# YouTube API
YOUTUBE_API_KEY=your_api_key_here
YOUTUBE_REGION_CODE=US
YOUTUBE_MAX_UPLOADS_PER_CHANNEL=25
YOUTUBE_STATS_REFRESH_LOOKBACK_HOURS=48

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://host:6379

# Reddit (future)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=
```

---

## ✅ Implementation Checklist

### Data Engineer Tasks
- [ ] Update database schema (add 2 new tables, modify 2 existing)
- [ ] Run migrations: `npm run db:generate && npm run db:push`
- [ ] Create `seed/watchlists/youtube.json`
- [ ] Create `scripts/seedYouTubeWatchlist.ts`
- [ ] Implement `resolveChannels` processor
- [ ] Implement `pullUploads` processor
- [ ] Implement `refreshStats` processor
- [ ] Enhance dedup algorithm in `lib/scoring/deduplication.ts`
- [ ] Implement `buildFeedCards` processor
- [ ] Test ingestion pipeline locally
- [ ] Verify dedup quality (check console logs)

### Ship Captain Tasks
- [ ] Add environment variables to Railway
- [ ] Create `lib/jobs/youtubeQueue.ts`
- [ ] Create `workers/youtubeWorker.ts`
- [ ] Update `workers/index.ts` to import YouTube worker
- [ ] Schedule all recurring jobs (5 jobs total)
- [ ] Update `app/api/scoreboard/route.ts` (use real data)
- [ ] Update `app/api/feed/route.ts` (use real data)
- [ ] Test API endpoints return real data
- [ ] Deploy to Railway (web + worker services)
- [ ] Monitor job execution (BullMQ dashboard or logs)

### UX Lead Tasks
- [ ] Create `TierBadge` component
- [ ] Create `RelatedCount` component
- [ ] Create `ComputedTimestamp` component
- [ ] Update `TickerCard` to use new components
- [ ] Update `SourcePills` to hide inactive sources
- [ ] Add computed timestamp to Masthead
- [ ] Test responsive layout with tier badges
- [ ] Create receipt modal (shows primary + related items)
- [ ] Wire feed card click to open receipt modal
- [ ] Polish animations for new UI elements

---

## 🚦 Testing Strategy

### Data Pipeline Tests (Data Engineer)
```bash
# Seed watchlist
npm run seed:youtube

# Manually trigger resolve job
curl http://localhost:3000/api/jobs/trigger?job=resolve_channels

# Check database
npm run db:studio
# Verify source_accounts populated

# Manually trigger pull job
curl http://localhost:3000/api/jobs/trigger?job=pull_uploads

# Check items table
# Check item_metric_snapshots table

# Manually trigger dedupe
curl http://localhost:3000/api/jobs/trigger?job=dedupe_events

# Check events table
# Check event_items table
```

### API Tests (Ship Captain)
```bash
# Test scoreboard
curl http://localhost:3000/api/scoreboard?window=now

# Test feed
curl http://localhost:3000/api/feed?window=now&limit=10

# Verify response shape matches spec
```

### UI Tests (UX Lead)
- [ ] Tier badges render correctly
- [ ] Related count shows when > 1
- [ ] Source pills only show YouTube (no X, no Reddit)
- [ ] Computed timestamp updates correctly
- [ ] Feed cards clickable
- [ ] Receipt modal displays primary + related items

---

## 📊 Success Metrics

**Data Quality:**
- ✅ All 9 channels resolved to channel IDs
- ✅ Items ingesting every 10 minutes (clippers)
- ✅ Dedup creates events with avg 3-5 related items
- ✅ Feed cards have "why it matters" text

**Performance:**
- ✅ Ingestion job completes in < 30s
- ✅ Dedupe job completes in < 60s
- ✅ Feed cards rebuild in < 10s
- ✅ API responds in < 200ms

**UI:**
- ✅ Real video titles appear in feed
- ✅ Tier badges visible
- ✅ Related counts accurate
- ✅ No layout shift on data load

---

**Status:** Ready to implement  
**Timeline:** 5-7 days  
**Next Checkpoint:** Friday - All jobs running, real data in UI

