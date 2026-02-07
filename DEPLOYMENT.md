# Deployment Guide - Dabbleverse Dashboard

## Railway Deployment (Recommended)

### Step 1: Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init
```

### Step 2: Create Services

Create **4 services** in your Railway project:

1. **PostgreSQL Database**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will auto-provide `DATABASE_URL`

2. **Redis**
   - Click "New" → "Database" → "Redis"
   - Railway will auto-provide `REDIS_URL`

3. **Web Service** (Next.js)
   - Click "New" → "GitHub Repo" (or "Empty Service")
   - Connect your GitHub repo
   - Set build command: `npm run build`
   - Set start command: `npm run start`
   - Expose port: `3000`

4. **Worker Service** (BullMQ)
   - Click "New" → "Empty Service"
   - Connect same GitHub repo
   - Set start command: `npm run worker`
   - No port exposure needed

### Step 3: Set Environment Variables

In **both Web and Worker services**, add these variables:

```bash
# Auto-provided by Railway
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Required: YouTube API
YOUTUBE_API_KEY=your_youtube_api_key_here

# Required: Reddit API
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=DabbleverseDashboard/1.0

# Production config
NEXT_PUBLIC_SITE_URL=https://thedabbleverse.com
NODE_ENV=production
ENABLE_WORKERS=true
SCORING_INTERVAL_SECONDS=300
INGESTION_INTERVAL_SECONDS=600
```

### Step 4: Deploy

```bash
# Push to GitHub (triggers auto-deploy)
git push origin main

# Or use Railway CLI
railway up
```

### Step 5: Run Migrations & Seed

After first deployment:

```bash
# Connect to Railway shell
railway run npm run db:push
railway run npm run seed
```

## Cloudflare Setup

### Step 1: Add Domain

1. Add `thedabbleverse.com` to Cloudflare
2. Update nameservers at your registrar

### Step 2: DNS Configuration

Add DNS records:

```
Type: CNAME
Name: @
Target: <your-railway-domain>.up.railway.app
Proxy: Enabled (orange cloud)
```

```
Type: CNAME
Name: www
Target: <your-railway-domain>.up.railway.app
Proxy: Enabled (orange cloud)
```

### Step 3: CDN Configuration

1. Go to **Caching** → **Configuration**
2. Set **Browser Cache TTL:** 30 seconds
3. Enable **Development Mode** during testing

### Step 4: Performance Settings

1. Go to **Speed** → **Optimization**
2. Enable:
   - Auto Minify (JS, CSS, HTML)
   - Brotli compression
   - HTTP/2 & HTTP/3

### Step 5: Security (WAF)

1. Go to **Security** → **WAF**
2. Set Security Level: **Medium**
3. Enable:
   - Bot Fight Mode
   - Rate Limiting (optional)

## Environment Variables Checklist

### Required for Web Service

- ✅ `DATABASE_URL` (auto-provided)
- ✅ `REDIS_URL` (auto-provided)
- ✅ `YOUTUBE_API_KEY`
- ✅ `REDDIT_CLIENT_ID`
- ✅ `REDDIT_CLIENT_SECRET`
- ✅ `REDDIT_USER_AGENT`
- ✅ `NEXT_PUBLIC_SITE_URL`
- ✅ `NODE_ENV=production`

### Required for Worker Service

- ✅ `DATABASE_URL` (auto-provided)
- ✅ `REDIS_URL` (auto-provided)
- ✅ `YOUTUBE_API_KEY`
- ✅ `REDDIT_CLIENT_ID`
- ✅ `REDDIT_CLIENT_SECRET`
- ✅ `REDDIT_USER_AGENT`
- ✅ `ENABLE_WORKERS=true`
- ✅ `SCORING_INTERVAL_SECONDS=300`
- ✅ `INGESTION_INTERVAL_SECONDS=600`

## Post-Deployment Checklist

### 1. Verify Services

```bash
# Check web service
curl https://thedabbleverse.com/api/scoreboard?window=now

# Check Railway logs
railway logs --service web
railway logs --service worker
```

### 2. Seed Initial Data

Edit seed files with real data:

1. `seed/watchlists/youtube.json` - Add real YouTube channel IDs
2. `seed/watchlists/reddit.json` - Add real subreddit names
3. `seed/entities/entities.json` - Add real characters/shows
4. `seed/entities/aliases.json` - Add real aliases

Then deploy and run:

```bash
railway run npm run seed
```

### 3. Monitor Workers

Check worker logs for ingestion:

```bash
railway logs --service worker --tail
```

You should see:
- "Starting YouTube ingestion..."
- "Found X enabled YouTube channels"
- "Fetching videos from..."
- "YouTube ingestion completed"

### 4. Test Scoring Pipeline

After ingestion runs, check if scores are computed:

```bash
# Check database
railway run npx drizzle-kit studio

# Check API
curl https://thedabbleverse.com/api/scoreboard?window=now
```

### 5. Performance Testing

Use Lighthouse or WebPageTest:

- LCP < 2.0s (desktop)
- LCP < 2.5s (mobile)
- No layout shifts
- Proper caching headers

## Troubleshooting

### Workers Not Running

Check worker service logs:

```bash
railway logs --service worker --tail
```

Common issues:
- Missing `ENABLE_WORKERS=true`
- Redis connection failed (check `REDIS_URL`)
- Missing API credentials

### API Returns Empty Data

1. Check if ingestion has run:
   ```bash
   railway run npm run db:studio
   # Check "items" table for data
   ```

2. Run ingestion manually:
   ```bash
   railway run npm run worker
   ```

3. Check seed data:
   ```bash
   railway run npm run seed
   ```

### Database Connection Errors

1. Verify `DATABASE_URL` is set in Railway
2. Check Postgres service is running
3. Run migrations:
   ```bash
   railway run npm run db:push
   ```

### Redis Connection Errors

1. Verify `REDIS_URL` is set in Railway
2. Check Redis service is running
3. Restart worker service

## Maintenance

### Updating Seed Data

```bash
# Edit seed files locally
# Commit and push
git add seed/
git commit -m "Update seed data"
git push origin main

# Run seed script
railway run npm run seed
```

### Viewing Logs

```bash
# Web service
railway logs --service web

# Worker service
railway logs --service worker

# Database queries (slow query log)
railway logs --service postgres
```

### Database Backup

Railway auto-backs up PostgreSQL. To manual backup:

```bash
railway run pg_dump $DATABASE_URL > backup.sql
```

### Scaling

In Railway dashboard:

1. **Web service:** Increase replicas (horizontal scaling)
2. **Worker service:** Keep at 1 replica (BullMQ handles concurrency)
3. **Database:** Upgrade plan for more resources

## Cost Estimates

### Railway (Starter Plan: $5/mo)

- Web service: ~$5/mo
- Worker service: ~$5/mo
- PostgreSQL: ~$5/mo
- Redis: ~$5/mo

**Total: ~$20/mo**

### Cloudflare

- Free plan should suffice for MVP
- Pro plan ($20/mo) if you need advanced caching

### APIs

- YouTube Data API: Free (10,000 units/day)
- Reddit API: Free (60 requests/min)

**Total estimated cost: $20-40/mo**

## Security Best Practices

1. ✅ Use environment variables (never hardcode secrets)
2. ✅ Enable Cloudflare WAF
3. ✅ Rotate API keys every 90 days
4. ✅ Use HTTPS only (enforced by Cloudflare)
5. ✅ Monitor Railway logs for suspicious activity
6. ✅ Rate-limit API endpoints (Cloudflare)
7. ✅ Keep dependencies updated (`npm audit`)

## Support

For Railway support:
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway

For Cloudflare support:
- Docs: https://developers.cloudflare.com
- Community: https://community.cloudflare.com
