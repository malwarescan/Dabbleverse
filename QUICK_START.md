# 🚀 Quick Start - YouTube Pipeline

**Time to launch:** 15 minutes  
**Goal:** Get real YouTube videos ingesting into your local database

---

## Step 1: Database Setup (5 min)

```bash
# Generate migrations from schema
npm run db:generate

# Apply migrations to database
npm run db:push

# Verify tables created
npm run db:studio
# Check for: source_accounts, item_metric_snapshots tables
```

**What you'll see:**
- New migrations in `drizzle/` folder
- Drizzle Studio opens at `https://local.drizzle.studio`
- Tables: `source_accounts`, `item_metric_snapshots`, updated `items`, `events`, `feed_cards`

---

## Step 2: Seed YouTube Channels (2 min)

```bash
# Seed the 9 real YouTube channels
npm run seed:youtube
```

**Expected Output:**
```
🎬 Seeding YouTube watchlist...

📁 Processing tier: clippers
  ✅ Seeded clippers: SoThoroughJoeBurrow
  ✅ Seeded clippers: DOOMSPAYUH
  ✅ Seeded clippers: Stallyn19
  ✅ Seeded clippers: DURTYJERZEYRRAT
  ✅ Seeded clippers: Wil_Herren
  ✅ Seeded clippers: PEST__

📁 Processing tier: weekly_wrap
  ✅ Seeded weekly_wrap: BYB_POD
  ✅ Seeded weekly_wrap: PovosClownTown
  ✅ Seeded weekly_wrap: NJRanger201

🎉 Successfully seeded 9 YouTube channels!

📊 Summary:
  Clippers: 6
  Weekly Wrap: 3
  Total: 9
```

**Verify:**
```bash
npm run db:studio
# Navigate to `source_accounts` table
# Should see 9 rows with handles but no channel_id yet
```

---

## Step 3: Add YouTube API Key (2 min)

Create `.env.local` in project root:

```bash
# Copy from .env.example
cp .env.example .env.local
```

Add your YouTube API key:

```bash
# YouTube API
YOUTUBE_API_KEY=AIzaSy...your_key_here
YOUTUBE_REGION_CODE=US
YOUTUBE_MAX_UPLOADS_PER_CHANNEL=25
YOUTUBE_STATS_REFRESH_LOOKBACK_HOURS=48

# Database (should already be there)
DATABASE_URL=postgresql://user:pass@localhost:5432/dabbleverse

# Redis (should already be there)
REDIS_URL=redis://localhost:6379
```

**Get YouTube API Key:**
1. Go to https://console.cloud.google.com/
2. Create project (or use existing)
3. Enable YouTube Data API v3
4. Create credentials → API Key
5. Copy key to `.env.local`

---

## Step 4: Start Worker (1 min)

```bash
# Start worker in dev mode (auto-restarts on changes)
npm run worker:dev
```

**Expected Output:**
```
🔧 YouTube workers initialized

📅 Scheduling YouTube jobs...
  ✅ Scheduled: resolve_channels (run once)
  ✅ Scheduled: pull_uploads_clippers (every 10 min)
  ✅ Scheduled: pull_uploads_weekly (every 30 min)
  ✅ Scheduled: refresh_stats (every 15 min)
  ✅ Scheduled: dedupe_events (every 10 min)
  ✅ Scheduled: build_feed_cards (every 5 min)

🎉 All YouTube jobs scheduled successfully!
🚀 YouTube workers started and jobs scheduled!

[YouTube Worker] Processing job: resolve_channels
🔍 Resolving YouTube channels...
  Found 9 unresolved channels
  🔎 Searching for: SoThoroughJoeBurrow
    ✅ Resolved: So Thorough - Joe Burrow (UC...)
  🔎 Searching for: DOOMSPAYUH
    ✅ Resolved: DOOMSPAYUH (UC...)
  ...

✅ Resolved 9/9 channels
[YouTube Worker] ✅ Job resolve_channels completed in 4521ms
```

**Keep this terminal open!** Worker will continue running and processing jobs.

---

## Step 5: Watch the Magic Happen (5 min)

### In 10 minutes: First Ingestion

Worker logs will show:

```
[YouTube Worker] Processing job: pull_uploads
📥 Pulling uploads for tier: clippers

  Found 6 channels to ingest

  🎬 Processing: So Thorough - Joe Burrow
    📹 Found 25 videos
    ✅ Ingested 25 videos

  🎬 Processing: DOOMSPAYUH
    📹 Found 25 videos
    ✅ Ingested 25 videos
  ...

✅ Ingestion complete for clippers:
    Total items: 150
    Errors: 0
```

### Check Database:

```bash
# Open another terminal
npm run db:studio
```

Navigate to tables:
1. **`source_accounts`** - Should see `channel_id` populated for all 9 channels
2. **`items`** - Should see 150+ videos (25 per channel × 6 clippers)
3. **`item_metric_snapshots`** - Should see 150+ rows (1 per video)

### In 20 minutes: Deduplication

Worker logs will show:

```
[Dedupe Worker] Processing job: dedupe_events
🔗 Processing 150 recent YouTube items for deduplication...

  🆕 Created new event: "John Melendez CAUGHT LYING..."
  ✅ Attached "Another clip about John..." to event (similarity: 78%)
  🆕 Created new event: "Shuli Egar RESPONDS to..."
  ...

✅ Deduplication complete:
    New events: 35
    Attached to existing: 115
    Total processed: 150
```

Check database:
1. **`events`** - Should see 30-40 events
2. **`event_items`** - Should see 150+ links

### In 25 minutes: Feed Cards

Worker logs will show:

```
[Feed Worker] Processing job: build_feed_cards
🎴 Building feed cards...

  📊 Processing window: now
    Found 35 recent events
    ✅ Created/updated cards for now

  📊 Processing window: 24h
    ...

✅ Feed cards build complete: 105 cards
```

Check database:
1. **`feed_cards`** - Should see cards with real YouTube titles
2. Each card has `tier`, `relatedCount`, `why` fields populated

---

## Step 6: Start Next.js Dev Server (1 min)

In **another terminal**:

```bash
npm run dev
```

Open http://localhost:3000

**What you'll see:**
- Still using mock data (APIs not switched yet)
- But database has real data ready!

---

## 🎯 Success Checklist

After 30 minutes, you should have:

- [x] ✅ 9 YouTube channels resolved
- [x] ✅ 150+ videos ingested
- [x] ✅ 150+ metric snapshots
- [x] ✅ 30-40 events created (dedupe working)
- [x] ✅ 100+ feed cards generated
- [x] ✅ Worker running without errors
- [x] ✅ Jobs executing on schedule

---

## 🐛 Troubleshooting

### Problem: "YOUTUBE_API_KEY not found"
**Solution:** Check `.env.local` exists and has the API key

### Problem: "Redis connection failed"
**Solution:** 
```bash
# Start Redis (if using Docker)
docker-compose up -d redis

# Or install locally:
brew install redis
brew services start redis
```

### Problem: "Database connection failed"
**Solution:**
```bash
# Start PostgreSQL (if using Docker)
docker-compose up -d postgres

# Or check your DATABASE_URL in .env.local
```

### Problem: "YouTube API quota exceeded"
**Solution:**
- Daily quota: 10,000 units
- Each ingestion uses ~100 units
- Wait 24 hours or create new API key
- Reduce `YOUTUBE_MAX_UPLOADS_PER_CHANNEL` to 10

### Problem: "No videos appearing in items table"
**Solution:**
1. Check worker logs for errors
2. Verify channels have recent uploads (check YouTube)
3. Manually trigger ingestion:
```bash
node -e "require('./lib/jobs/youtubeQueue').triggerJob('pull_uploads', {tier:'clippers'})"
```

### Problem: "Dedup not creating events"
**Solution:**
1. Make sure items table has data first
2. Check worker logs for dedup job execution
3. Manually trigger dedup:
```bash
node -e "require('./lib/jobs/youtubeQueue').triggerJob('dedupe_events')"
```

---

## 📊 Monitoring

### Watch Worker Logs
```bash
# Worker terminal shows all job execution
# Look for: ✅ (success) or ❌ (error)
```

### Check Job Queue (BullMQ Board)
```bash
# TODO: Add BullMQ Board UI
npm install -g bull-board
# Then visit http://localhost:3000/admin/queues
```

### Database Queries
```sql
-- Check channel resolution
SELECT handle, channel_id, display_name, last_resolved_at 
FROM source_accounts;

-- Check video count
SELECT tier, COUNT(*) as count 
FROM items 
WHERE platform = 'youtube' 
GROUP BY tier;

-- Check event clustering
SELECT COUNT(*) as event_count, 
       AVG(related_count) as avg_related 
FROM events;

-- Check feed cards
SELECT window, COUNT(*) as count 
FROM feed_cards 
GROUP BY window;
```

---

## 🚀 Next Steps (Day 2)

Once you have real data flowing:

1. **Switch API endpoints** to use real data instead of mock
2. **Update UI components** to display tier badges and related counts
3. **Test feed ticker** with real YouTube video titles
4. **Deploy to Railway** (web + worker services)

See `SPRINT_BREAKDOWN.md` for detailed Day 2 tasks.

---

**Status:** Ready to launch! 🚀  
**Time investment:** 15 minutes setup → Real data flowing forever  
**Questions:** Check `YOUTUBE_PIPELINE_STATUS.md` for detailed status
