# 🚀 GET REAL DATA NOW - 5 Steps

**Current Status:** APIs work, but database is empty  
**Goal:** Get real YouTube clips flowing  
**Time:** 30 minutes total

---

## 📋 QUICK STATUS CHECK

Run this to see current state:

```bash
# Check if database is set up
npm run db:studio
# Look for: source_accounts, items, feed_cards tables
```

---

## STEP 1: Verify Database URL (1 min)

**Check your `.env.local` file:**

```bash
cat .env.local | grep DATABASE_URL
```

**You should see:**
```
DATABASE_URL=postgresql://user:pass@localhost:5432/dabbleverse
```

**If not set up:**

### Option A: Use Docker (Fastest)
```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Your DATABASE_URL should be:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dabbleverse
REDIS_URL=redis://localhost:6379
```

### Option B: Use Railway (Cloud)
```bash
# Go to https://railway.app
# Create new project → Add PostgreSQL
# Copy DATABASE_URL from Railway dashboard
# Paste into .env.local
```

### Option C: Use Neon/Supabase (Free)
```bash
# Neon: https://neon.tech (free tier)
# Create database → Copy connection string
# Paste into .env.local
```

---

## STEP 2: Run Migrations (2 min)

```bash
# Generate migration files
npm run db:generate

# Push to database
npm run db:push
```

**Expected Output:**
```
✓ Your SQL migration file ➜ drizzle/0000_xxx.sql
✓ Pushed schema to database
```

**Verify:**
```bash
npm run db:studio
# Opens Drizzle Studio
# You should see 12 tables including:
#   - source_accounts
#   - items
#   - item_metric_snapshots
#   - events
#   - feed_cards
```

---

## STEP 3: Seed YouTube Channels (1 min)

```bash
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
# Open source_accounts table
# Should see 9 rows with handles but no channel_id yet
```

---

## STEP 4: Add YouTube API Key (2 min)

**Edit `.env.local`:**

```bash
# Add this line:
YOUTUBE_API_KEY=your_actual_youtube_api_key_here
```

**Get YouTube API Key:**

1. Go to https://console.cloud.google.com/
2. Create new project (or use existing)
3. Enable "YouTube Data API v3"
4. Create credentials → API Key
5. Copy the key
6. Paste into `.env.local`

**Your `.env.local` should have:**
```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
YOUTUBE_API_KEY=AIzaSy...your_key_here
```

---

## STEP 5: Start Worker (Start Ingestion)

```bash
# Start the worker (this ingests videos)
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
    ✅ Resolved: So Thorough - Joe Burrow (UCxxxxxxxxxxx)
  🔎 Searching for: DOOMSPAYUH
    ✅ Resolved: DOOMSPAYUH (UCxxxxxxxxxxx)
  ...

✅ Resolved 9/9 channels
[YouTube Worker] ✅ Job resolve_channels completed in 4521ms
```

**Keep this terminal open!** The worker will continue running.

---

## ⏰ TIMELINE TO REAL DATA

### Minute 0-5: Channel Resolution
```
[YouTube Worker] Processing job: resolve_channels
✅ Resolved 9/9 channels
```

**Check database:**
```bash
npm run db:studio
# source_accounts table now has channel_id for all 9 rows
```

---

### Minute 10-15: First Video Ingestion
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
  
  (... 4 more channels ...)

✅ Ingestion complete for clippers:
    Total items: 150
    Errors: 0
```

**Check database:**
```bash
npm run db:studio
# items table: 150+ rows (real YouTube videos!)
# item_metric_snapshots table: 150+ rows (views, likes, comments)
```

---

### Minute 20-25: Deduplication Creates Events
```
[Dedupe Worker] Processing job: dedupe_events
🔗 Processing 150 recent YouTube items for deduplication...

  🆕 Created new event: "John Melendez CAUGHT LYING About His Lawsuit!!"
  ✅ Attached "Another clip about John..." to event (similarity: 78%)
  🆕 Created new event: "Shuli Egar RESPONDS to..."
  ✅ Attached "Shuli follow-up..." to event (similarity: 82%)
  ...

✅ Deduplication complete:
    New events: 35
    Attached to existing: 115
    Total processed: 150
```

**Check database:**
```bash
npm run db:studio
# events table: 30-40 rows (deduped clusters)
# event_items table: 150+ links (items → events)
```

---

### Minute 25-30: Feed Cards Generated
```
[Feed Worker] Processing job: build_feed_cards
🎴 Building feed cards...

  📊 Processing window: now
    Found 35 recent events
    ✅ Created/updated cards for now

  📊 Processing window: 24h
    Found 35 recent events
    ✅ Created/updated cards for 24h

  📊 Processing window: 7d
    Found 35 recent events
    ✅ Created/updated cards for 7d

✅ Feed cards build complete: 105 cards
```

**Check database:**
```bash
npm run db:studio
# feed_cards table: 100+ rows (real feed cards!)
# Each card has:
#   - Real YouTube video title
#   - Real channel name
#   - Real timestamp
#   - "Why it matters" text
#   - Related count (from dedup)
```

---

## 🎉 MINUTE 30: REAL DATA LIVE!

### Test the APIs:

```bash
# Feed API - NOW HAS REAL DATA
curl "http://localhost:3000/api/feed?window=now" | jq
```

**You'll see:**
```json
{
  "computedAt": "2026-02-07T...",
  "window": "now",
  "cards": [
    {
      "id": "abc-123",
      "source": "youtube",
      "title": "John Melendez CAUGHT LYING About His Lawsuit!!",
      "meta": {
        "author": "DOOMSPAYUH",
        "channel": "DOOMSPAYUH",
        "timestamp": "2026-02-07T10:47:00Z",
        "platform": "youtube"
      },
      "why": "Clip spike driving momentum.",
      "url": "https://youtube.com/watch?v=abc123",
      "eventId": "event-xyz",
      "entityIds": ["entity-123"]
    },
    ... 19 more real cards ...
  ]
}
```

---

### Refresh Your Browser:

**Go to:** http://localhost:3000

**You'll see:**
- 🔴 CLIP badges (red)
- Real YouTube video titles
- Real channel names (@DOOMSPAYUH, @SoThoroughJoeBurrow)
- "1 event • 8 related posts" indicators
- Real timestamps ("47m ago")
- "Why it matters" context

**THIS IS 100% REAL DATA FROM YOUTUBE** 🎬

---

## 🔄 ONGOING: Auto-Updates

**The worker continues running:**

- Every **10 minutes**: New clipper videos ingested
- Every **30 minutes**: Weekly wrap videos ingested
- Every **15 minutes**: Stats refreshed (views, likes update)
- Every **10 minutes**: Deduplication runs (new events created)
- Every **5 minutes**: Feed cards rebuilt (new content appears)

**Your site auto-updates with fresh YouTube clips!** 🚀

---

## 📊 VERIFY DATA IS REAL

### Check a specific video:

1. Copy a title from your feed
2. Search it on YouTube
3. Verify it's a REAL video from a REAL channel
4. Check the timestamp matches
5. Check the view count is real

**No more fake data. Everything is REAL.** ✅

---

## 🐛 TROUBLESHOOTING

### "No videos appearing after 15 minutes"

**Check worker logs:**
```bash
# Look for errors in worker terminal
# Common issues:
#   - YouTube API quota exceeded (10,000 units/day)
#   - Invalid API key
#   - Network/firewall blocking YouTube API
```

**Solution:**
```bash
# Manually trigger ingestion
node -e "require('./lib/jobs/youtubeQueue').triggerJob('pull_uploads', {tier:'clippers'})"
```

---

### "Database connection failed"

**Check DATABASE_URL:**
```bash
echo $DATABASE_URL
# Should show: postgresql://...
```

**If using Docker:**
```bash
docker ps
# Should show postgres container running
```

**Test connection:**
```bash
npm run db:studio
# Should open without errors
```

---

### "Worker not starting"

**Check Redis:**
```bash
# If using Docker:
docker ps | grep redis

# Test Redis:
redis-cli ping
# Should return: PONG
```

**Check REDIS_URL:**
```bash
echo $REDIS_URL
# Should show: redis://localhost:6379
```

---

## 🎯 SUCCESS CHECKLIST

After 30 minutes, verify:

- [ ] ✅ 9 channels in `source_accounts` with `channel_id` populated
- [ ] ✅ 150+ videos in `items` table
- [ ] ✅ 150+ snapshots in `item_metric_snapshots` table
- [ ] ✅ 30-40 events in `events` table
- [ ] ✅ 100+ cards in `feed_cards` table
- [ ] ✅ API returns real data (not empty array)
- [ ] ✅ Browser shows real YouTube video titles
- [ ] ✅ CLIP badges visible (red)
- [ ] ✅ Related counts accurate ("1 event • X related posts")

**If all checked: YOU HAVE REAL DATA!** 🎉

---

## 📈 WHAT'S NEXT

**Day 1 (Today):**
- ✅ Get real YouTube data flowing
- ✅ See actual clips in feed
- ✅ Verify deduplication working

**Day 2:**
- Build Entity Hub drawer (click rows for details)
- Add "What Changed" rail (risers/fallers)
- Entity matching (link videos to characters)

**Day 3-5:**
- Implement scoring algorithm
- Add watchlist + alerts
- Deploy to Railway

---

**Status:** Ready to get real data  
**Timeline:** 30 minutes from start to live data  
**Next:** Follow Steps 1-5 above
