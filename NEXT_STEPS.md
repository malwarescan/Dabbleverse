# 🚀 Next Steps - Get Dabbleverse Dashboard Running

## Immediate Actions (Do This First)

### 1. Configure Seed Data with Real Information

**Edit these 4 files with your actual data:**

#### A. YouTube Channels (`seed/watchlists/youtube.json`)

Replace placeholder channel IDs with real ones:

```json
{
  "channels": [
    {
      "id": "UCxxxxxxxxxxxxxx",  // ← Real YouTube channel ID
      "name": "Actual Channel Name",
      "url": "https://youtube.com/@actualchannel",
      "category": "core_show",
      "weight": 1.0,
      "enabled": true
    }
    // Add 10-25 channels
  ]
}
```

**How to get YouTube channel IDs:**
1. Go to channel page
2. View page source
3. Search for `"channelId":"` or `"externalId":"`
4. Copy the ID (looks like `UCxxxxxxxxxxxxxx`)

#### B. Reddit Subreddits (`seed/watchlists/reddit.json`)

```json
{
  "subreddits": [
    {
      "name": "actual_subreddit_name",  // ← Real subreddit (without r/)
      "category": "primary",
      "weight": 1.0,
      "enabled": true
    }
    // Add 3-10 subreddits
  ]
}
```

#### C. Entities (`seed/entities/entities.json`)

Add your actual Characters, Shows, and Storylines:

```json
{
  "entities": [
    {
      "id": "char-real-person-1",
      "type": "character",
      "canonical_name": "Real Person Name",
      "description": "Brief description",
      "enabled": true
    }
    // Add 10-20 entities
  ]
}
```

#### D. Aliases (`seed/entities/aliases.json`)

Add matching patterns for each entity:

```json
{
  "aliases": [
    {
      "entity_id": "char-real-person-1",
      "alias_text": "real person name",
      "match_type": "exact",
      "platform_scope": "any",
      "confidence_weight": 1.0
    },
    {
      "entity_id": "char-real-person-1",
      "alias_text": "nickname",
      "match_type": "exact",
      "platform_scope": "any",
      "confidence_weight": 0.9
    }
    // Add 2-6 aliases per entity
  ]
}
```

### 2. Get API Credentials

#### YouTube Data API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable "YouTube Data API v3"
4. Create credentials → API Key
5. Copy the API key

#### Reddit API

1. Go to [Reddit Apps](https://www.reddit.com/prefs/apps)
2. Click "create another app..."
3. Select "script"
4. Fill in name and redirect URI (http://localhost:3000)
5. Copy "client ID" and "secret"

### 3. Set Up Local Environment

```bash
# In /Users/malware/Desktop/projects/dabbleverse

# Edit .env.local with your credentials
nano .env.local
```

**Required variables:**
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dabbleverse
REDIS_URL=redis://localhost:6379
YOUTUBE_API_KEY=your_actual_youtube_api_key
REDDIT_CLIENT_ID=your_actual_reddit_client_id
REDDIT_CLIENT_SECRET=your_actual_reddit_secret
REDDIT_USER_AGENT=DabbleverseDashboard/1.0
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
ENABLE_WORKERS=false
```

### 4. Set Up Local Databases

**Option A: Use Docker (Recommended)**

```bash
# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: dabbleverse
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
EOF

# Start databases
docker-compose up -d
```

**Option B: Install Locally**

- Install PostgreSQL 15+
- Install Redis 7+
- Create database: `createdb dabbleverse`

### 5. Initialize Database & Seed Data

```bash
# Push database schema
npm run db:push

# Load seed data (with your real data from step 1)
npm run seed
```

### 6. Start Development Servers

**Terminal 1: Web Server**
```bash
npm run dev
```

**Terminal 2: Workers (optional for development)**
```bash
npm run worker:dev
```

**Terminal 3: Test Ingestion (optional)**
```bash
# Manually trigger YouTube ingestion
npm run worker
# Check logs for "Starting YouTube ingestion..."
```

### 7. Open Browser

```
http://localhost:3000
```

You should see:
- ✅ ESPN-style scoreboard UI
- ✅ Mock data initially (until ingestion runs)
- ✅ Auto-refresh every 60 seconds
- ✅ Time window selector (Now/24h/7d)

## Testing Ingestion

### Test YouTube Ingestion

```bash
# In a new terminal
npm run worker
```

Watch logs for:
```
Starting YouTube ingestion...
Found X enabled YouTube channels
Fetching videos from [channel name]...
Found Y videos
YouTube ingestion completed
```

Check database:
```bash
npm run db:studio
# Opens Drizzle Studio at http://localhost:4983
# Check "items" table for new YouTube videos
```

### Test Reddit Ingestion (Phase 2)

Same process as YouTube, workers will also fetch Reddit posts.

## Common Issues & Fixes

### Issue: "Redis connection failed"

**Fix:**
```bash
# Check if Redis is running
redis-cli ping
# Should return "PONG"

# If not running, start it:
docker-compose up redis -d
# or
brew services start redis
```

### Issue: "Database connection failed"

**Fix:**
```bash
# Check if Postgres is running
psql -U postgres -d dabbleverse -c "SELECT 1;"
# Should return "1"

# If not running:
docker-compose up postgres -d
# or
brew services start postgresql
```

### Issue: "YouTube API quota exceeded"

**Fix:**
- YouTube API has 10,000 units/day free quota
- Each video fetch uses ~3-5 units
- Wait 24 hours or upgrade quota
- Reduce `maxResults` in ingestion config

### Issue: "No data showing on scoreboard"

**Fix:**
1. Check if seed data loaded: `npm run db:studio`
2. Run ingestion: `npm run worker`
3. Check API directly: `curl http://localhost:3000/api/scoreboard?window=now`
4. Currently shows mock data until real scoring runs

## Deploy to Production

Once everything works locally:

1. **Read DEPLOYMENT.md** for full Railway + Cloudflare setup
2. Push code to GitHub
3. Create Railway project with 4 services
4. Set environment variables in Railway
5. Deploy and run seed script
6. Point Cloudflare DNS to Railway

## Quick Reference

```bash
# Development
npm run dev              # Start Next.js dev server
npm run worker:dev       # Start workers with auto-reload

# Database
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio (GUI)
npm run seed             # Load seed data

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run worker           # Start production workers
```

## Need Help?

1. Check logs: `railway logs --service [web|worker]`
2. Review README.md for architecture overview
3. Review DEPLOYMENT.md for deployment steps
4. Check PROJECT_SUMMARY.md for what's built

## Success Checklist

- ✅ Seed files have real YouTube channels (not placeholders)
- ✅ Seed files have real Reddit subreddits
- ✅ Seed files have 10-20 real entities with aliases
- ✅ YouTube API key is valid and set in .env.local
- ✅ Reddit credentials are valid and set in .env.local
- ✅ PostgreSQL is running and schema is pushed
- ✅ Redis is running
- ✅ Seed data is loaded (`npm run seed` succeeds)
- ✅ Dev server runs without errors
- ✅ Ingestion runs and stores items in database
- ✅ Scoreboard UI renders properly

**Once all checkboxes are complete, you're ready to deploy to production!**
