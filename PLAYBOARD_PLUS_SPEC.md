# Playboard++ — Monetization + Attention OS

Single unified system: **Public Mode** (any tracked channel) + **Owner Mode** (OAuth for true revenue + audience). One event schema, one rollup system, one UI.

## Mapping to current stack

| Spec concept | Current implementation |
|--------------|------------------------|
| **channels** | `source_accounts` (platform=youtube); `channelId` = YouTube channel id |
| **streams** | `live_streams` (video_id, source_account_id, status, active_live_chat_id, title, started_at) |
| **monetization_events** | `monetization_events` (super_chat, super_sticker, membership_gift, member_milestone) |
| **channel_rollup_day** | `channel_daily_superchat_rollups` (per channel per date, gross + breakdown) |
| **stream rollup** | `stream_superchat_rollups` (per video_id) |
| **stream_concurrency_samples** | NEW: `stream_concurrency_samples` |
| **channel_rollup_minute** | NEW: `channel_rollup_minute` (optional Phase 1) |
| **donor_rollup_day** | NEW: `donor_rollup_day` (Phase 2) |
| **oauth_revenue_day** | NEW: `oauth_revenue_day` (Phase 3) |

**Naming in UI**
- Public metric: **"Super Chat Gross (Observed)"** / **"Observed Gross"**
- Owner metric: **"Estimated Revenue (Official)"** (Phase 3)

---

## 1. Data pipelines

### A) Public pipeline (current + extensions)
1. **Stream discovery** — `detect_live_streams` (StreamDetector) every 45–90s → upsert `live_streams`, enqueue ChatPoller + ConcurrencySampler.
2. **Concurrency sampling** — NEW: poll `liveStreamingDetails.concurrentViewers` every 30–60s → `stream_concurrency_samples`.
3. **Paid events** — `poll_live_chat` (ChatPoller) → `monetization_events` (dedupe by message_id).
4. **Stream metadata** — already from videos.list (title, etc.); can add description, category, tags later.

### B) Owner pipeline (Phase 3)
- OAuth + YouTube Analytics API → `oauth_revenue_day`, audience metrics.

---

## 2. Canonical data model (Postgres)

See `lib/db/schema.ts`. Additions:
- `stream_concurrency_samples` — video_id, sampled_at, concurrent_viewers.
- `channel_rollup_minute` — channel_id, minute_ts, gross_amount_micros_usd, event_count, unique_donors, concurrent_avg, concurrent_peak (Phase 1 optional).
- `donor_rollup_day` — channel_id, date, author_channel_id, gross_usd, event_count, etc. (Phase 2).
- `oauth_revenue_day` — channel_id, date, estimated_revenue_usd, etc. (Phase 3).

Existing tables stay; `source_accounts` + `live_streams` + `monetization_events` + `channel_daily_superchat_rollups` + `stream_superchat_rollups` are the core.

---

## 3. Workers (BullMQ)

| Worker | Job id | Frequency | Current |
|--------|--------|-----------|---------|
| **StreamDetector** | `detect_live_streams` | 45–90s | ✅ every 2 min |
| **ChatPoller** | `poll_live_chat` | per live video, continuous | ✅ every 1 min |
| **ConcurrencySampler** | `sample_concurrency` | per live video, 30–60s | NEW |
| **RollupBuilder** | (inline in ChatPoller + on stream end) | real-time + finalize | ✅ in poll_live_chat |
| **FXRateRefresher** | `refresh_fx_rates` | daily | Optional (USD-only MVP) |
| **OwnerAnalyticsSync** | `sync_owner_analytics` | hourly/daily | Phase 3 |

---

## 4. APIs (Next.js)

| Spec | Current / Add |
|------|----------------|
| `GET /api/leaderboard?window=today\|60m\|15m` | `GET /api/live/leaderboard` (+ optional ?window=60m) |
| `GET /api/channel/:id/live` | `GET /api/live/channel/[id]/today` + extend |
| `GET /api/channel/:id/rollup?date=` | Use channel_daily + concurrency |
| `GET /api/channel/:id/donors?date=` | NEW Phase 2 |
| `GET /api/stream/:videoId/summary` | From stream_superchat_rollups + live_streams |
| `GET /api/stream/:videoId/events?since=` | `GET /api/live/stream/[videoId]/events` |
| Realtime (SSE/WS) | Phase 1/2: polling; Phase 2+: SSE/WS |

---

## 5. MVP order (Phase 1)

- [x] Watchlist + StreamDetector (`detect_live_streams`)
- [x] ChatPoller + raw paid events (`poll_live_chat` + `monetization_events`)
- [x] **ConcurrencySampler** + `stream_concurrency_samples` (`sample_concurrency` every 1 min)
- [x] **Minute rollups** table `channel_rollup_minute` (schema ready; backfill optional)
- [x] Leaderboard + channel/stream pages
- [x] **Unified API** `GET /api/leaderboard?window=today|60m` (label: "Super Chat Gross (Observed)")
- [x] Cron `GET /api/cron/live` enqueues detect + poll + sample_concurrency
- [ ] Realtime: SSE/WS later

Phase 2: donor rollups, $/1k concurrent, moments.  
Phase 3: OAuth, official revenue, reconciliation.

---

## Apply schema changes

After pulling, run:

```bash
pnpm run db:push
```

This creates `stream_concurrency_samples`, `channel_rollup_minute`, `donor_rollup_day`, `oauth_revenue_day`. Existing tables unchanged.
