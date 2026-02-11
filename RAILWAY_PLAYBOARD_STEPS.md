# Step-by-step: Get Playboard data on thedabbleverse.com

Do these in order.

---

## 1. Add Redis on Railway

The worker needs Redis. Without it the worker exits and no live data is captured.

1. Open [Railway](https://railway.app) → your **Dabbleverse** project.
2. Click **+ New** → **Database** → **Add Redis** (or **Add Plugin** → Redis).
3. After it’s created, click your **web app service** (the one that runs the site).
4. Go to **Variables**. Confirm **REDIS_URL** is there (Railway often adds it when Redis is in the same project). If not, click **+ New Variable** → **Add Reference** → choose the Redis service’s **REDIS_URL**.

---

## 2. Set the start command (if needed)

The repo is set so the start command runs both the site and the worker.

1. In Railway, open your **web app service**.
2. Go to **Settings** (or the service’s **⋮** menu).
3. Find **Deploy** / **Start Command** (or **Custom start command**).
4. If it’s set to something like `npm run start`, change it to:
   ```bash
   npm run start:with-worker
   ```
5. If there’s no custom start command, leave it blank — the build uses the one in `nixpacks.toml` (`npm run start:with-worker`).

---

## 3. Confirm env vars on the web service

On the **web app** service → **Variables**, you should have:

- **DATABASE_URL** (from your Postgres service)
- **REDIS_URL** (from Redis)
- **YOUTUBE_API_KEY** (your YouTube Data API v3 key)

If any are missing, add them. Save.

---

## 4. Resolve channel IDs in the production DB

Live detection only runs for channels that have `channel_id` set.

**Option A – From your laptop (easiest)**

1. In `.env.local` set **DATABASE_URL** to your Railway **public** Postgres URL (from Postgres service → Connect → “Public” URL, not internal).
2. In `.env.local` set **YOUTUBE_API_KEY** to your key.
3. In the project folder run:
   ```bash
   pnpm run resolve:channels
   ```
4. You should see “Resolved X/X channels”. That updates the same DB Railway uses.

**Option B – From Railway CLI**

1. Install CLI: `npm i -g @railway/cli`
2. In the project: `railway link` (choose the project).
3. Run: `railway run pnpm run resolve:channels`
4. (Requires `tsx` in dependencies and a way to run the script on Railway; Option A is simpler.)

---

## 5. Deploy

1. Commit and push your latest code (including the worker + rollup fixes):
   ```bash
   git add -A && git status
   git commit -m "Playboard: worker start in nixpacks, rollups on every poll"
   git push
   ```
2. Railway will build and deploy. Wait until the deployment is **Success**.

---

## 6. Trigger a run (optional)

After deploy, the worker runs on a schedule. To run the pipeline once right away:

1. Open: `https://thedabbleverse.com/api/cron/live`
2. If you set **CRON_SECRET**, use: `https://thedabbleverse.com/api/cron/live?secret=YOUR_CRON_SECRET`
3. You should see: `{"ok":true,"message":"detect_live_streams + poll_live_chat + sample_concurrency enqueued"}`

That queues detection + chat polling. Give it 1–2 minutes, then refresh the Playboard.

---

## 7. Check the Playboard

1. Open **https://thedabbleverse.com/playboard**
2. You should see:
   - **Live now** – if any tracked channel is live (and worker has run).
   - **Today’s profit by channel** and **Stream profit** – live streams can show **$0.00** until Super Chats happen; then numbers update.

If it still says “No real data yet”:

- Check **Deployments** → latest deploy → **View logs**. Look for “Starting all workers” and “Scheduled: detect_live_streams”. If you see “Redis not configured”, add/fix **REDIS_URL** (step 1).
- Run step 4 again if you’re not sure channel IDs were resolved for the DB Railway uses.
- Run step 6 and wait 2 minutes, then refresh the Playboard.

---

## Quick checklist

- [ ] Redis added and **REDIS_URL** on the web service
- [ ] **DATABASE_URL** and **YOUTUBE_API_KEY** on the web service
- [ ] Start command is `npm run start:with-worker` (or left default so nixpacks uses it)
- [ ] `pnpm run resolve:channels` run against the Railway DB (with Railway public URL in `.env.local`)
- [ ] Code pushed and deploy succeeded
- [ ] Hit `/api/cron/live` once, wait ~2 min, then check `/playboard`
