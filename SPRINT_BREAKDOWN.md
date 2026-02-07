# 🏃 Sprint Breakdown - YouTube Ingestion Pipeline

**Sprint Duration:** 5-7 days  
**Goal:** Ship real YouTube data → Replace all mock data  
**Success:** User sees real clipper videos in feed + scoreboard

---

## 📅 Day-by-Day Execution Plan

### **DAY 1: Foundation Setup** (All hands, parallel work)

#### 🔧 Data Engineer - Morning
```bash
⏱️ 3-4 hours
```
**Tasks:**
1. Update database schema
   - Add `source_accounts` table
   - Add `item_metric_snapshots` table
   - Add `tier` column to `items`
   - Add `platformMix`, `relatedCount` to `events`
   - Add `tier`, `relatedCount` to `feedCards`
2. Generate migrations: `npm run db:generate`
3. Apply migrations: `npm run db:push`
4. Verify in Drizzle Studio: `npm run db:studio`

**Deliverable:** ✅ Database schema updated and verified

#### 🔧 Data Engineer - Afternoon
```bash
⏱️ 3-4 hours
```
**Tasks:**
1. Create `seed/watchlists/youtube.json` (9 channels)
2. Create `scripts/seedYouTubeWatchlist.ts`
3. Run seed script: `npm run seed:youtube`
4. Verify `source_accounts` table populated with 9 rows

**Deliverable:** ✅ YouTube watchlist seeded

---

#### 🚀 Ship Captain - Morning
```bash
⏱️ 2-3 hours
```
**Tasks:**
1. Add YouTube API key to Railway environment variables
2. Test YouTube API key locally: `curl` or Postman
3. Create `lib/jobs/youtubeQueue.ts` (queue definitions)
4. Create empty processor files (stubs):
   - `lib/jobs/processors/resolveChannels.ts`
   - `lib/jobs/processors/pullUploads.ts`
   - `lib/jobs/processors/refreshStats.ts`
   - `lib/jobs/processors/buildFeedCards.ts`

**Deliverable:** ✅ Queue infrastructure ready

#### 🚀 Ship Captain - Afternoon
```bash
⏱️ 3-4 hours
```
**Tasks:**
1. Create `workers/youtubeWorker.ts` skeleton
2. Update `workers/index.ts` to import YouTube worker
3. Wire up job routing (switch statement)
4. Test worker starts: `npm run worker`
5. Test queue accepts jobs: manual trigger via Redis CLI

**Deliverable:** ✅ Worker service running (even if processors are empty)

---

#### 🎨 UX Lead - Morning
```bash
⏱️ 2-3 hours
```
**Tasks:**
1. Create `components/ui/TierBadge.tsx`
   - Design "CLIP" badge (red theme)
   - Design "WEEKLY" badge (blue theme)
   - Test in Storybook or isolated page
2. Create `components/ui/RelatedCount.tsx`
   - Design "1 event, 6 related posts" indicator
   - Test with different counts (2, 5, 10, 20)

**Deliverable:** ✅ Tier badge + related count components

#### 🎨 UX Lead - Afternoon
```bash
⏱️ 2-3 hours
```
**Tasks:**
1. Create `components/ui/ComputedTimestamp.tsx`
2. Update `components/scoreboard/Masthead.tsx` to show timestamp
3. Update `components/ui/SourcePills.tsx` logic:
   - Hide X pills
   - Hide Reddit pills if value = 0
4. Test in browser with mock data

**Deliverable:** ✅ UI components ready for real data

---

### **DAY 2: Ingestion Pipeline** (Data + Ship Captain pair)

#### 🔧 Data Engineer - Morning
```bash
⏱️ 4-5 hours
```
**Tasks:**
1. Implement `resolveChannels` processor
   - YouTube Search API integration
   - Extract `@handle` from URL
   - Upsert into `source_accounts`
   - Test with 1 channel first, then all 9
2. Manual test: trigger resolve job
3. Verify all 9 channels have `channel_id` populated

**Deliverable:** ✅ Channel resolution working

**Ship Captain supports:** Test API calls, debug rate limits, check logs

---

#### 🔧 Data Engineer - Afternoon
```bash
⏱️ 4-5 hours
```
**Tasks:**
1. Implement `pullUploads` processor
   - Get uploads playlist ID
   - Fetch latest 25 videos per channel
   - Get video details + stats
   - Upsert into `items`
   - Insert snapshots into `item_metric_snapshots`
2. Manual test: trigger pull job for `clippers` tier
3. Verify `items` table has videos
4. Verify `item_metric_snapshots` has stats

**Deliverable:** ✅ Video ingestion working

**Ship Captain supports:** Monitor worker logs, check for errors, verify data in DB

---

#### 🎨 UX Lead - Full Day
```bash
⏱️ 6-8 hours
```
**Tasks:**
1. Create receipt modal component
   - `components/modals/ReceiptModal.tsx`
   - Shows primary item (title, thumbnail, stats)
   - Shows related items list (up to 10)
   - Links open in new tab
   - Close button + ESC key handler
2. Wire modal to feed card click
   - Add `onClick` to `TickerCard`
   - Fetch event details: `GET /api/event/:id/items`
   - Open modal with data
3. Style modal mobile-responsive
4. Test on desktop + mobile

**Deliverable:** ✅ Receipt modal working (uses mock data for now)

---

### **DAY 3: Dedup + Feed Cards** (Data Engineer focus)

#### 🔧 Data Engineer - Morning
```bash
⏱️ 4-5 hours
```
**Tasks:**
1. Enhance `lib/scoring/deduplication.ts`
   - Implement `normalizeTitle()` function
   - Implement Jaccard similarity
   - Implement time bucket logic
   - Implement `generateEventKey()`
   - Implement `deduplicateYouTubeItems()` function
2. Add logging: show which items matched, similarity scores
3. Manual test: run dedupe once
4. Check `events` table: verify event creation
5. Check `event_items` table: verify item linking

**Deliverable:** ✅ Dedup algorithm working

---

#### 🔧 Data Engineer - Afternoon
```bash
⏱️ 3-4 hours
```
**Tasks:**
1. Implement `updatePrimaryItems()` logic
   - Calculate velocity from snapshots
   - Choose highest velocity item as primary
   - Update `events.primary_item_id`
2. Implement `buildFeedCards` processor
   - Query events by `last_seen_at`
   - Generate "why it matters" text
   - Upsert into `feed_cards` table
3. Manual test: run feed card job
4. Verify `feed_cards` table populated

**Deliverable:** ✅ Feed card generation working

---

#### 🚀 Ship Captain - Morning
```bash
⏱️ 3-4 hours
```
**Tasks:**
1. Schedule all recurring jobs in `youtubeQueue.ts`
   - `resolve_channels` (once on startup)
   - `pull_uploads` clippers (every 10 min)
   - `pull_uploads` weekly (every 30 min)
   - `refresh_stats` (every 15 min)
   - `dedupe_events` (every 10 min)
   - `build_feed_cards` (every 5 min)
2. Test schedules work: wait 10 minutes, check logs
3. Verify jobs run automatically

**Deliverable:** ✅ All jobs scheduled and running

#### 🚀 Ship Captain - Afternoon
```bash
⏱️ 2-3 hours
```
**Tasks:**
1. Create `GET /api/event/:id/items` endpoint
   - Returns primary item + related items
   - Used by receipt modal
2. Test endpoint with real event ID
3. Verify JSON shape matches UI needs

**Deliverable:** ✅ Event items API ready

---

#### 🎨 UX Lead - Full Day
```bash
⏱️ 4-6 hours
```
**Tasks:**
1. Update `TickerCard` component
   - Add `TierBadge`
   - Add `RelatedCount`
   - Wire click to receipt modal
2. Test with real API data (from Day 2 ingestion)
3. Polish animations, loading states
4. Test mobile responsive layout
5. Update `TickerDock` to pass event IDs to cards

**Deliverable:** ✅ Ticker displays real data with tier badges

---

### **DAY 4: Switch APIs to Real Data** (Ship Captain + Data Engineer)

#### 🚀 Ship Captain - Morning
```bash
⏱️ 3-4 hours
```
**Tasks:**
1. Update `app/api/feed/route.ts`
   - Replace `generateMockFeed()` with real query
   - Query `feed_cards` table
   - Return JSON matching spec
2. Test endpoint: `curl http://localhost:3000/api/feed?window=now`
3. Verify UI receives real data
4. Check for errors in browser console

**Deliverable:** ✅ Feed API returns real data

---

#### 🔧 Data Engineer - Morning (pairs with Ship Captain)
```bash
⏱️ 3-4 hours
```
**Tasks:**
1. Create query functions in `lib/utils/queries.ts`
   - `getScoreboardRows(window)` - query `scores` table
   - Implement entity name matching (temporary string matching)
   - Return scoreboard rows with sources, momentum, driver
2. Test queries in Drizzle Studio or `tsx` script

**Deliverable:** ✅ Scoreboard query functions ready

---

#### 🚀 Ship Captain - Afternoon
```bash
⏱️ 2-3 hours
```
**Tasks:**
1. Update `app/api/scoreboard/route.ts`
   - Replace `generateMockScoreboard()` with `getScoreboardRows()`
   - Return JSON matching spec
2. Test endpoint: `curl http://localhost:3000/api/scoreboard?window=now`
3. Verify UI receives real data
4. Check scoreboard displays real video titles (if entity matching works)

**Deliverable:** ✅ Scoreboard API returns real data

---

#### 🎨 UX Lead - Full Day
```bash
⏱️ 4-6 hours
```
**Tasks:**
1. Test entire UI with real data from APIs
2. Fix any styling issues (truncation, overflow, alignment)
3. Verify tier badges appear on feed cards
4. Verify related counts show correctly
5. Verify source pills only show YouTube (no X, no Reddit)
6. Verify computed timestamp updates
7. Take screenshots for review
8. Document any bugs or edge cases

**Deliverable:** ✅ Full UI tested with real data

---

### **DAY 5: Scoring + Deployment** (All hands)

#### 🔧 Data Engineer - Morning
```bash
⏱️ 4-5 hours
```
**Tasks:**
1. Implement scoring computation in `workers/index.ts`
   - Calculate velocity from `item_metric_snapshots`
   - Apply platform weights (YouTube only for now)
   - Calculate percentile ranks
   - Compute momentum (current vs previous window)
   - Classify driver labels
2. Upsert into `scores` table
3. Test scoring job manually
4. Verify `scores` table populated with realistic scores

**Deliverable:** ✅ Scoring computation working

---

#### 🔧 Data Engineer - Afternoon
```bash
⏱️ 3-4 hours
```
**Tasks:**
1. Fine-tune dedup algorithm
   - Adjust Jaccard threshold (0.55 → 0.50 or 0.60?)
   - Review console logs for false positives/negatives
   - Test with edge cases (very similar titles, very different titles)
2. Fine-tune "why it matters" text
   - Review feed cards in UI
   - Improve logic based on tier + velocity
3. Optimize queries (add indexes if needed)

**Deliverable:** ✅ Data quality polished

---

#### 🚀 Ship Captain - Full Day
```bash
⏱️ 6-8 hours
```
**Tasks:**
1. Deploy to Railway
   - Push code to GitHub
   - Railway auto-deploys `web` service
   - Configure `worker` service (Procfile)
   - Add all environment variables to Railway
   - Run migrations on production DB
2. Seed production watchlist
   - SSH into Railway or run script via Railway CLI
   - Verify `source_accounts` populated
3. Monitor production logs
   - Check worker logs (BullMQ jobs running)
   - Check API logs (requests succeeding)
   - Check for errors (rate limits, API failures)
4. Set up health checks
   - Create `GET /api/health` endpoint
   - Monitor uptime (Railway dashboard)
5. Configure Cloudflare
   - DNS + CDN
   - Caching rules for API endpoints

**Deliverable:** ✅ Production deployment live

---

#### 🎨 UX Lead - Full Day
```bash
⏱️ 4-6 hours
```
**Tasks:**
1. Final UI polish
   - Fix any visual bugs from testing
   - Improve hover states, transitions
   - Test on multiple screen sizes (iPhone, iPad, desktop)
2. Create loading states for feed cards
   - Skeleton loaders while fetching
   - "No data yet" empty state
3. Create error states
   - "Failed to load feed" message
   - Retry button
4. Test production deployment
   - Visit live URL
   - Test all interactions
   - Report any issues
5. Take final screenshots + record demo video

**Deliverable:** ✅ Production UI polished

---

### **DAY 6-7: Testing + Iteration** (All hands)

#### All Team - Quality Assurance
```bash
⏱️ 2 days buffer for bugs, edge cases, iteration
```

**Data Engineer:**
- [ ] Monitor dedup quality (check for duplicates, missed matches)
- [ ] Monitor scoring accuracy (spot-check scores make sense)
- [ ] Optimize slow queries (if any API calls > 300ms)
- [ ] Fix any data pipeline bugs

**Ship Captain:**
- [ ] Monitor production uptime (Railway dashboard)
- [ ] Monitor error rates (Sentry or logs)
- [ ] Tune caching TTLs (if needed)
- [ ] Fix any API bugs reported by UX Lead
- [ ] Document deployment process for team

**UX Lead:**
- [ ] User acceptance testing (act like a real user)
- [ ] Test all user flows end-to-end
- [ ] Document any UX issues or improvements
- [ ] Create bug tickets for team
- [ ] Prepare demo for stakeholders

---

## 🚦 Parallel Work Opportunities

**Days 1-2:** All three can work independently
- Data Engineer: Schema + ingestion
- Ship Captain: Infrastructure + queues
- UX Lead: UI components + modal

**Day 3:** Some pairing needed
- Data Engineer: Dedup (independent)
- Ship Captain: Job scheduling (independent)
- UX Lead: Integrate real data (waits for Data Engineer)

**Day 4:** Close collaboration
- Ship Captain + Data Engineer: Switch APIs to real data (pair work)
- UX Lead: Test + polish (independent)

**Day 5:** Deploy day
- Ship Captain: Deployment (owns it)
- Data Engineer: Scoring + fine-tuning (independent)
- UX Lead: Final polish (independent)

---

## 🎯 Daily Standup Questions

Each person answers:
1. **What did you ship yesterday?** (concrete deliverable)
2. **What are you shipping today?** (specific task)
3. **Are you blocked?** (dependencies, missing info)
4. **What's your confidence?** (🟢 on track, 🟡 at risk, 🔴 blocked)

**Example:**
```
[Data Engineer] - Day 2
✅ Yesterday: Channel resolution working, all 9 channels resolved
🔨 Today: Pull uploads processor, aim for 100+ videos ingested
🚧 Blocked: No
📊 Confidence: 🟢 On track
```

---

## ✅ Definition of Done (End of Sprint)

### Data Pipeline
- [x] YouTube channels seeded (9 channels)
- [x] Channels resolved to `channel_id`
- [x] Videos ingesting automatically (clippers: 10min, weekly: 30min)
- [x] Stats refreshing every 15 minutes
- [x] Dedup creating events with avg 3-5 related items
- [x] Feed cards rebuilding every 5 minutes
- [x] Scoring computing scores (even if basic)

### APIs
- [x] `GET /api/feed` returns real YouTube data
- [x] `GET /api/scoreboard` returns real scores
- [x] `GET /api/event/:id/items` returns event details
- [x] All APIs respond < 300ms p95
- [x] Redis caching working

### UI
- [x] Feed cards show real video titles
- [x] Tier badges visible ("CLIP", "WEEKLY")
- [x] Related counts accurate ("1 event, 6 related posts")
- [x] Source pills only show YouTube
- [x] Computed timestamp displays and updates
- [x] Receipt modal opens on feed card click
- [x] Receipt modal shows primary + related items
- [x] Mobile responsive (all screen sizes)
- [x] No layout shift on data load

### Deployment
- [x] Deployed to Railway (web + worker)
- [x] Production database migrated
- [x] Environment variables configured
- [x] Watchlist seeded in production
- [x] Workers running (check logs)
- [x] Health checks responding
- [x] Cloudflare DNS + CDN configured

---

## 📊 Success Metrics (Friday Review)

**Data Quality:**
- ✅ At least 100 videos ingested
- ✅ At least 30 events created (dedup working)
- ✅ Dedup avg 3-5 items per event (not 1-to-1)
- ✅ Feed cards have "why it matters" text

**Performance:**
- ✅ Ingestion job: < 30s per channel
- ✅ Dedupe job: < 60s total
- ✅ Feed cards: < 10s to rebuild
- ✅ API response: < 200ms p95

**User Experience:**
- ✅ Real video titles in feed (not "Mock Video")
- ✅ Tier badges render correctly
- ✅ Related counts show (when > 1)
- ✅ Receipt modal functional
- ✅ No console errors
- ✅ Mobile + desktop tested

---

## 🐛 Common Pitfalls (Avoid These)

### Data Engineer
- ❌ **Don't** use `any` type without justification
- ❌ **Don't** skip error handling (try/catch all API calls)
- ❌ **Don't** commit API keys (use env vars)
- ❌ **Don't** run migrations without backing up DB
- ✅ **Do** log every job execution (success + failure)
- ✅ **Do** test with small datasets first (1 channel → all 9)

### Ship Captain
- ❌ **Don't** deploy without testing locally first
- ❌ **Don't** skip migration step in production
- ❌ **Don't** hard-code environment values
- ❌ **Don't** expose sensitive data in logs
- ✅ **Do** test each API endpoint individually
- ✅ **Do** monitor Railway logs during deploy
- ✅ **Do** have rollback plan ready

### UX Lead
- ❌ **Don't** assume real data will be perfect (handle empty states)
- ❌ **Don't** test only on your device (test mobile + desktop)
- ❌ **Don't** skip loading states (APIs can be slow)
- ❌ **Don't** break mobile layout for desktop features
- ✅ **Do** use mock data for rapid UI iteration
- ✅ **Do** test edge cases (very long titles, missing fields)
- ✅ **Do** document any visual bugs for team

---

## 📞 Communication Channels

**Slack Channels:**
- `#dabbleverse-dev` - General development chat
- `#dabbleverse-data` - Data pipeline questions
- `#dabbleverse-deploy` - Deployment + infra
- `#dabbleverse-bugs` - Bug reports

**When to Ping Team:**
- 🚨 **Immediate:** Blocker (can't proceed)
- ⚠️ **Same day:** Need clarification on spec
- ℹ️ **Next standup:** Nice-to-have question

**Decision Authority:**
- **Data Engineer:** Owns dedup thresholds, scoring formulas
- **Ship Captain:** Owns deployment timing, infra config
- **UX Lead:** Owns UI/UX decisions, component design

---

## 🎉 Friday Demo Script

**Each person shows:**

**Data Engineer:**
1. Show Drizzle Studio with real data tables
2. Show console logs of dedup job (similarity scores)
3. Show `feed_cards` table with "why it matters" text

**Ship Captain:**
1. Show Railway dashboard (services running)
2. Show API responses in Postman/curl
3. Show caching working (response times)

**UX Lead:**
1. Show live production site on mobile + desktop
2. Click through user flows (view feed, open modal)
3. Show tier badges, related counts, timestamps

**Team celebrates:** 🎉 First real data in production!

---

**Next Sprint:** Entity Hub Drawer + Changes Rail (TIER 1 features)

