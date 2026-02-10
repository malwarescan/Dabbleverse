# How to get DATABASE_URL and run db:push

You need a **Postgres connection URL** in the form:

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

You do **not** need to push to production first. You can develop locally or use a production URL from your laptop.

---

## Option A: Local Postgres (dev on your machine)

1. **Install Postgres** (if you don’t have it):
   - macOS: `brew install postgresql@16` then `brew services start postgresql@16`
   - Or use [Postgres.app](https://postgresapp.com/)

2. **Create a database:**
   ```bash
   createdb dabbleverse
   ```

3. **Create `.env.local`** in the project root (copy from `.env.example`):
   ```bash
   cp .env.example .env.local
   ```

4. **Set DATABASE_URL** in `.env.local`. Typical local URL:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dabbleverse
   ```
   Or if your Postgres user has no password:
   ```env
   DATABASE_URL=postgresql://YOUR_MAC_USERNAME@localhost:5432/dabbleverse
   ```

5. **Push the schema:**
   ```bash
   pnpm run db:push
   ```

---

## Option B: Railway — use the **public** DB URL for local

Railway gives two URLs: **Internal** (`postgres.railway.internal`) only works from services on Railway; your laptop cannot reach it. **Public** (host like `monorail.proxy.rlwy.net`) is reachable from your machine. For local `pnpm run db:push` you must use the **public** URL.

If you deploy on **Railway** and add a **Postgres** service:

1. Open your project in Railway → **Postgres** service.
2. In **Connect** or **Variables**, copy the **public** connection string (host should NOT be `postgres.railway.internal`).
3. Put it in **`.env.local`** in the project root:
   ```env
   DATABASE_URL=postgresql://postgres:xxxxx@containers-us-west-xxx.railway.app:6432/railway
   ```
4. From your **local** machine run:
   ```bash
   pnpm run db:push
   ```
   That applies your schema to the **production** Postgres. No need to “push code” first; you just need the URL.

---

## Option C: Run db:push on Railway (no public URL needed)

Run the command inside Railway's environment so it uses the internal URL:

1. Install Railway CLI: `npm i -g @railway/cli`
2. Log in and link the project: `railway link`
3. Run:
   ```bash
   railway run pnpm run db:push
   ```
   This runs `db:push` in Railway’s environment, so it uses Railway's DATABASE_URL and applies the schema.

---

## Running the worker on Railway

The worker runs `detect_live_streams`, `poll_live_chat`, and `sample_concurrency` so the DB stays updated.

**Single-service setup (recommended):** The Procfile runs `npm run start:with-worker`, which starts **both** the Next.js server and the worker in the same deploy. You do **not** need a second Railway service.

**You must have Redis.** The worker uses BullMQ and requires `REDIS_URL`:

1. In Railway, add **Redis** to your project (New → Database → Redis, or Add Plugin).
2. In your **web app** service, ensure the Redis plugin is linked (or set `REDIS_URL` in Variables). Railway usually injects `REDIS_URL` when Redis is linked.
3. Redeploy. The same service runs Next.js and the worker; check logs for `Starting all workers` and `Scheduled: detect_live_streams`.

If `REDIS_URL` is missing, the worker process exits and you’ll see `Redis not configured. Workers cannot start.` in the logs — add Redis and redeploy.

To seed from your machine against the Railway DB, use the **public** URL in `.env.local` and run:
- `pnpm run seed:youtube` — seed channels
- **`pnpm run resolve:channels`** — resolve YouTube channel IDs (needs `YOUTUBE_API_KEY`). **Required** for live stream detection: `detect_live_streams` only considers channels that have `channel_id` set.
- `pnpm run seed:playboard` — seed playboard/leader rollup demo data

---

## Why it wasn’t working

- `drizzle.config.ts` only had `process.env.DATABASE_URL` and **didn’t load** `.env.local`, so when you ran `pnpm run db:push` in the terminal, `DATABASE_URL` was empty.
- **Fix:** The Drizzle config now loads `.env.local` (and `.env`) before reading `DATABASE_URL`. So:
  1. Create `.env.local` with a valid `DATABASE_URL` (local or copied from Railway).
  2. Run `pnpm run db:push` again.

You do **not** need to deploy first. You only need **any** Postgres (local or cloud) and its URL in `.env.local`.
