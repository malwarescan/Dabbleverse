# 🎯 Strategic Roadmap - Google/ESPN Consultant Feedback

**Date:** February 7, 2026  
**Source:** Top consultants from Google & ESPN  
**Status:** Brainstorming - Not implementing yet

---

## ✅ What's Working (Keep This)

1. **Macro Layout is Correct**
   - Sports broadcast UI achieved
   - Big brand + segmented time windows
   - Stacked Top 10 cards
   - Bottom feed dock with cards
   - This is the right foundation

2. **"Why it matters" Context**
   - Feed cards include narrative hooks
   - Turns raw links into stories
   - Right concept, needs enhancement

3. **Visual Direction**
   - Dark broadcast aesthetic
   - Time window selector functionality
   - Card-based mobile-first design

---

## 🚨 Critical Insight from Consultants

> **"Right now it's a pretty list. ESPN feels addictive because every row is a portal into context, comparison, and live consequences."**

The product needs **"sticky mechanics"** that reward:
- ✅ Clicking (discovery)
- ✅ Tracking (watchlists)
- ✅ Returning (alerts, changes)

---

## 🏗️ Current Component Structure

### Frontend Components
```
components/
├── scoreboard/
│   ├── Masthead.tsx              ← Time selector, brand, status
│   ├── ScoreboardTable.tsx       ← Top 10 rankings
│   ├── MoversRail.tsx            ← Top movers sidebar
│   └── CategoryCards.tsx         ← Characters/Shows/Storylines/Chatters/Clippers
├── ticker/
│   └── TickerDock.tsx            ← Bottom feed dock
└── ui/
    ├── Badge.tsx                 ← Rank/Momentum/Source/Driver badges
    ├── ScoreBar.tsx              ← Score visualization
    └── SourcePills.tsx           ← Platform indicators
```

### API Endpoints
```
app/api/
├── scoreboard/route.ts           ← GET /api/scoreboard?window=X&type=Y
├── movers/route.ts               ← GET /api/movers?window=X
└── feed/route.ts                 ← GET /api/feed?window=X
```

### Backend Logic
```
lib/
├── db/
│   ├── schema.ts                 ← Drizzle ORM schema (8 tables)
│   └── index.ts                  ← Database client
├── scoring/
│   ├── calculator.ts             ← Momentum + driver classification
│   └── deduplication.ts          ← Event clustering
├── ingestion/
│   ├── youtube.ts                ← YouTube Data API
│   └── reddit.ts                 ← Reddit API (Snoowrap)
└── utils/
    ├── queries.ts                ← Database queries
    ├── redis.ts                  ← Caching layer
    └── mockData.ts               ← Mock data (currently active)
```

---

## 🎯 12 Feature Enhancements (Prioritized by Impact)

### 🔥 **TIER 1: Must-Have for Product-Market Fit**

#### 1. Entity Hub Drawer (HIGHEST PRIORITY)
**Impact:** Turns rankings into "why rankings"  
**Current Gap:** Rows are dead ends  
**User Need:** Context, proof, trends

**Components to Create:**
```
components/entity/
├── EntityDrawer.tsx              ← Slide-out drawer component
├── EntityHeader.tsx              ← Name, type, current rank
├── TrendChart.tsx                ← Mini sparkline (60m/6h/24h/7d)
├── ReceiptsList.tsx              ← Top 5 items driving score
├── SourceBreakdown.tsx           ← YouTube vs Reddit pie/bars
├── DriverHistory.tsx             ← Timeline of driver changes
├── CoMentionsList.tsx            ← Related entities graph
└── AliasPanel.tsx                ← Matched names (transparency)
```

**API Endpoint:**
```
GET /api/entity/:id?window=X
Response: {
  entity: {...},
  trend: [{timestamp, score, rank}],
  topReceipts: [{item, score_contribution, driver}],
  sourceBreakdown: {youtube: 0.6, reddit: 0.4},
  driverHistory: [{driver, since, until}],
  coMentions: [{entity, frequency, context}],
  aliases: [{text, matched_count}]
}
```

**State Management:**
```typescript
// In app/page.tsx or context
const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
const [entityDrawerOpen, setEntityDrawerOpen] = useState(false);
```

**Implementation Notes:**
- Use Radix UI Drawer or custom slide-in
- Fetch entity data on row click
- Cache entity data (Redis, 60s TTL)
- Close drawer with ESC or backdrop click
- Show loading skeleton while fetching

---

#### 2. "What Changed" Right Rail (HIGH PRIORITY)
**Impact:** Answers "what's different since last visit"  
**Current Gap:** MoversRail exists but not prominent enough  
**User Need:** Quick scan of changes

**Components to Enhance:**
```
components/scoreboard/
├── MoversRail.tsx                ← Already exists, enhance
└── ChangesRail.tsx               ← New: comprehensive changes view
```

**Add to ChangesRail:**
- 🔥 **Biggest Risers** (top 5 by +momentum)
- 📉 **Biggest Fallers** (top 5 by -momentum)
- ⭐ **New Entrants** (entered Top 10 in this window)
- ⚡ **Overheated** (micro-momentum > 50%, rank hasn't caught up)
- 🔄 **Rank Swaps** (entities that traded positions)

**API Endpoint:**
```
GET /api/changes?window=X
Response: {
  risers: [{entity, momentum, oldRank, newRank}],
  fallers: [{entity, momentum, oldRank, newRank}],
  newEntrants: [{entity, rank, since}],
  overheated: [{entity, microMomentum, currentRank}],
  swaps: [{entity1, entity2, ranks}]
}
```

---

#### 3. Real Ticker Behavior (HIGH PRIORITY)
**Impact:** Makes feed feel "live" and intelligent  
**Current Gap:** Static card list  
**User Need:** Broadcast-style continuous updates

**Enhancements to TickerDock.tsx:**
```typescript
// Auto-advance logic
useEffect(() => {
  if (!isPaused) {
    const interval = setInterval(() => {
      scrollToNext();
    }, 7000); // 7 seconds per card
    return () => clearInterval(interval);
  }
}, [isPaused]);

// Pause on hover
<div 
  onMouseEnter={() => setIsPaused(true)}
  onMouseLeave={() => setIsPaused(false)}
>
```

**Add Lanes:**
```
components/ticker/
├── TickerDock.tsx                ← Main container
├── BreakingLane.tsx              ← Newest event (red badge)
├── ReceiptsLane.tsx              ← Strongest driver events
└── TickerCard.tsx                ← Individual card (click → Entity Hub)
```

**Enhanced Card Display:**
```typescript
// Show dedup indicator
{event.itemCount > 1 && (
  <div className="dedup-badge">
    1 event • {event.itemCount} related posts
  </div>
)}
```

---

### ⚡ **TIER 2: Engagement Multipliers**

#### 4. Matchup Mode (Shareable Feature)
**Impact:** Makes product viral/shareable  
**Current Gap:** No comparison tools  
**User Need:** "Who's winning X vs Y?"

**New Components:**
```
components/matchup/
├── MatchupSelector.tsx           ← Pick 2 entities
├── MatchupCard.tsx               ← Head-to-head comparison
├── MatchupChart.tsx              ← Side-by-side trend lines
└── HeadToHeadEvents.tsx          ← Co-mentioned events
```

**New Page:**
```
app/matchup/page.tsx              ← /matchup?entity1=X&entity2=Y
```

**API Endpoint:**
```
GET /api/matchup?entity1=X&entity2=Y&window=Z
Response: {
  entity1: {score, momentum, rank, sources},
  entity2: {score, momentum, rank, sources},
  headToHead: {
    coMentionCount: 15,
    recentEvents: [{event, context}],
    advantage: 'entity1' | 'entity2' | 'tie'
  }
}
```

---

#### 5. Storylines as First-Class Layer
**Impact:** Reduces noise, creates narrative  
**Current Gap:** Storylines are just another entity type  
**User Need:** Arc-driven context

**New Components:**
```
components/storylines/
├── StorylineCard.tsx             ← Shows involved entities + timeline
├── StorylineTimeline.tsx         ← Event progression
└── StorylineGraph.tsx            ← Entity relationship map
```

**Enhanced Schema:**
```typescript
// Add to storylines
storylineEntities: {
  storylineId: uuid,
  entityId: uuid,
  role: 'protagonist' | 'antagonist' | 'participant'
}
```

**New Page:**
```
app/storylines/page.tsx           ← Directory of active storylines
app/storylines/[id]/page.tsx      ← Individual storyline timeline
```

---

#### 6. Watchlist + Alerts System
**Impact:** Drives daily active users  
**Current Gap:** No personalization  
**User Need:** "Tell me when X changes"

**New Components:**
```
components/watchlist/
├── WatchlistButton.tsx           ← Star/unstar entity
├── WatchlistPage.tsx             ← Your tracked entities
├── AlertSettings.tsx             ← Configure alert rules
└── AlertBanner.tsx               ← In-app notifications
```

**New Tables:**
```sql
watchlist_items (user_id, entity_id, created_at)
alerts (user_id, entity_id, rule_type, threshold, enabled)
alert_history (alert_id, triggered_at, entity_id, context)
```

**Alert Rules:**
- "Top 10 Entry" - Entity enters Top 10
- "Momentum Spike" - Momentum > +25%
- "Co-Mention" - Entity appears with another entity
- "New Receipt" - New event includes entity

---

### 🔧 **TIER 3: Trust & Power Features**

#### 7. Trust & Methodology Panel
**Impact:** Builds credibility with receipts-obsessed users  
**Current Gap:** Score is black box  
**User Need:** "Prove it"

**Add to Entity Drawer:**
```
components/entity/
├── ScoreExplainer.tsx            ← "Why score is 94.9"
├── DataQualityMeter.tsx          ← Low/Med/High confidence
├── InclusionLog.tsx              ← Items included/excluded
└── ComputationTimestamp.tsx      ← Last computed time
```

**Show:**
- Formula breakdown (YouTube: 0.6, Reddit: 0.4)
- Which items contributed to score
- Spam filter decisions
- Data completeness (% of window covered)

---

#### 8. Fix MVP Scope (X/Twitter)
**Impact:** Prevents trust erosion  
**Current Gap:** X pills shown but not active  
**User Need:** Clear about what's real

**Quick Fix:**
```typescript
// In SourcePills.tsx
const activeSources = Object.entries(sources)
  .filter(([platform, value]) => {
    if (platform === 'x') return false; // Hide X until Phase 3
    return value > 0;
  });
```

**Or show disabled state:**
```typescript
{platform === 'x' && (
  <SourceBadge platform="x" disabled tooltip="Phase 3" />
)}
```

---

#### 9. Power User Controls
**Impact:** Discovery and customization  
**Current Gap:** One-size-fits-all view  
**User Need:** Filters, search, sorting

**Add to Masthead/Toolbar:**
```
components/controls/
├── EntityTypeFilter.tsx          ← Characters / Shows / Storylines tabs
├── SourceFilter.tsx              ← YouTube-only / Reddit-only toggle
├── SortSelector.tsx              ← Score / Momentum / Delta Rank
└── EntitySearch.tsx              ← Typeahead search
```

**State:**
```typescript
const [filters, setFilters] = useState({
  entityType: 'all' | 'character' | 'show' | 'storyline',
  source: 'all' | 'youtube' | 'reddit',
  sort: 'score' | 'momentum' | 'deltaRank'
});
```

---

#### 10. Clip-Native Experience
**Impact:** Video receipts are the currency  
**Current Gap:** External links only  
**User Need:** In-app video proof

**Add to Entity Drawer:**
```
components/entity/
├── InlineVideoPlayer.tsx         ← Embedded YouTube player
└── TimestampedClip.tsx           ← Jump to exact moment
```

**Implementation:**
```typescript
// Use YouTube IFrame API
<iframe
  src={`https://www.youtube.com/embed/${videoId}?start=${timestamp}`}
  allow="accelerometer; autoplay; clipboard-write; encrypted-media"
/>
```

---

#### 11. Enhanced Heat Mechanics
**Impact:** Makes product feel alive  
**Current Gap:** Limited driver labels  
**User Need:** Broadcast-grade status badges

**Expand Driver Labels:**
```typescript
// Add to calculator.ts
export const DRIVER_LABELS_V2 = {
  ...DRIVER_LABELS,
  breakout: 'Breakout',           // New entrant + high momentum
  dominating: 'Dominating',       // Rank 1 with widening lead
  volatile: 'Volatile',           // Momentum swings both directions
}
```

**Visual Enhancements:**
```typescript
// Different badge colors per driver
const DRIVER_COLORS = {
  clip_spike: 'red',
  breakout: 'orange',
  dominating: 'gold',
  comeback: 'green',
  volatile: 'purple',
  slow_burn: 'blue',
}
```

---

#### 12. Shareable Artifacts
**Impact:** Viral growth lever  
**Current Gap:** No social sharing  
**User Need:** Share rankings easily

**New Components:**
```
components/share/
├── ShareButton.tsx               ← Share menu
├── SnapshotGenerator.tsx         ← Server-side image render
└── EntityCard.tsx                ← Shareable entity card
```

**New API:**
```
GET /api/og/entity/:id            ← Open Graph image
GET /api/og/snapshot              ← Top 10 snapshot image
```

**Implementation:**
- Use `@vercel/og` for server-rendered images
- Generate 1200x630 OG images
- Include branding + key stats
- One-click copy link

---

## 🚀 Immediate Next Sprint (Highest ROI)

### Sprint Focus: Make Rows Into Portals

**If you only do 3 things, do these:**

#### 1️⃣ Entity Hub Drawer ⭐⭐⭐
**Effort:** 3-4 days  
**Impact:** 10x user engagement

**Tasks:**
- [ ] Create drawer component with slide-in animation
- [ ] Build API endpoint `/api/entity/:id`
- [ ] Implement mini trend chart (recharts or simple SVG)
- [ ] Show top 5 receipts with click-to-open
- [ ] Display source breakdown (pie chart or bars)
- [ ] Add driver history timeline
- [ ] Show co-mentioned entities
- [ ] Wire up click handler on ScoreboardTable rows

**Files to Create:**
```
components/entity/EntityDrawer.tsx           (NEW)
components/entity/EntityHeader.tsx           (NEW)
components/entity/TrendChart.tsx             (NEW)
components/entity/ReceiptsList.tsx           (NEW)
components/entity/SourceBreakdown.tsx        (NEW)
app/api/entity/[id]/route.ts                 (NEW)
lib/utils/entityQueries.ts                   (NEW)
```

---

#### 2️⃣ Enhanced "What Changed" Rail ⭐⭐⭐
**Effort:** 2 days  
**Impact:** Increases return visits

**Tasks:**
- [ ] Expand MoversRail.tsx to show risers + fallers
- [ ] Add "New Entrants" section
- [ ] Add "Overheated" indicators (micro-momentum)
- [ ] Add "Rank Swaps" visualization
- [ ] Create `/api/changes` endpoint
- [ ] Update queries to calculate deltas

**Files to Modify:**
```
components/scoreboard/MoversRail.tsx         (ENHANCE)
app/api/changes/route.ts                     (NEW)
lib/utils/queries.ts                         (ADD getChanges)
```

---

#### 3️⃣ Ticker Behavior Upgrade ⭐⭐
**Effort:** 1-2 days  
**Impact:** Feels "live"

**Tasks:**
- [ ] Add auto-advance scroll (7s per card)
- [ ] Add pause on hover
- [ ] Add Breaking/Receipts lanes
- [ ] Show dedup indicator on cards
- [ ] Wire ticker cards to open Entity Hub
- [ ] Add smooth scroll animations

**Files to Modify:**
```
components/ticker/TickerDock.tsx             (ENHANCE)
components/ticker/TickerCard.tsx             (SPLIT OUT)
components/ticker/BreakingLane.tsx           (NEW)
```

---

## 📋 Full Backlog (TIER 2 & 3)

### Phase 2 Features
- [ ] Matchup Mode (comparison tool)
- [ ] Storylines as first-class layer
- [ ] Power user controls (filters, search, sort)
- [ ] Clip-native experience (inline video)
- [ ] Enhanced heat mechanics (new driver labels)

### Phase 3 Features
- [ ] Watchlist + Alerts system
- [ ] Trust & methodology panel
- [ ] Shareable artifacts (OG images)
- [ ] User authentication
- [ ] Admin console

---

## 🎨 UX Patterns to Study

### ESPN.com
- **Entity pages:** Player stats, news, recent games
- **Matchup cards:** Team vs Team comparisons
- **Top movers:** "Who's hot" / "Who's not"
- **Live ticker:** Score updates with context

### Bloomberg Terminal
- **Trend sparklines:** Inline mini charts
- **Comparison mode:** Side-by-side metrics
- **News feed:** Timestamped, categorized, filterable
- **Watchlist:** Custom portfolios

### Twitter/X
- **Drawer navigation:** Slide-in panels
- **Infinite feed:** Auto-loading content
- **Engagement metrics:** Visible, real-time
- **Quote tweets:** Context + original post

---

## 🔧 Technical Implementation Notes

### Entity Hub Drawer Architecture

**State Flow:**
```
ScoreboardRow (click) 
  → setSelectedEntityId(row.entityId)
  → setEntityDrawerOpen(true)
  → Fetch /api/entity/:id
  → Render EntityDrawer with data
  → User clicks receipt → Opens YouTube/Reddit in new tab
  → User closes drawer → Back to scoreboard
```

**Performance:**
- Lazy load drawer (code split)
- Prefetch on hover (aggressive)
- Cache entity data (Redis 60s)
- Virtualize receipts list if > 20 items

### Changes Rail Algorithm

**Calculate Risers/Fallers:**
```typescript
// Compare current snapshot to previous window
const previousScores = await getScores(window, previousComputedAt);
const currentScores = await getScores(window, currentComputedAt);

const changes = currentScores.map(current => {
  const previous = previousScores.find(p => p.entityId === current.entityId);
  return {
    entity: current,
    rankChange: previous ? previous.rank - current.rank : null,
    momentumDelta: current.momentum - (previous?.momentum || 0),
    isNew: !previous,
    isOverheated: current.microMomentum > 50 && current.momentum > 20
  };
});
```

### Ticker Auto-Advance

**Smooth Scroll:**
```typescript
const scrollToNext = () => {
  const container = scrollRef.current;
  const cardWidth = 320; // card width + gap
  const currentScroll = container.scrollLeft;
  const nextScroll = currentScroll + cardWidth;
  
  container.scrollTo({
    left: nextScroll,
    behavior: 'smooth'
  });
  
  // Loop back to start if at end
  if (nextScroll >= container.scrollWidth - container.clientWidth) {
    setTimeout(() => {
      container.scrollTo({ left: 0, behavior: 'smooth' });
    }, 7000);
  }
};
```

---

## 📊 Success Metrics

### Engagement Metrics to Track

**Passive Users:**
- Page views
- Time on page
- Scroll depth

**Active Users (with Entity Hub):**
- Drawer open rate (% of visits)
- Receipts click rate
- Average drawers opened per session
- Co-mention exploration rate

**Power Users (with Watchlist):**
- Watchlist size (entities starred)
- Return visit rate (7-day retention)
- Alert engagement rate
- Matchup creation rate

**Viral Users (with Sharing):**
- Share button clicks
- OG image renders
- Inbound traffic from social

---

## 💰 Implementation Effort vs Impact Matrix

```
HIGH IMPACT, LOW EFFORT:
✅ Fix X pill visibility (30 min)
✅ Enhance What Changed rail (2 days)
✅ Ticker auto-advance (1 day)

HIGH IMPACT, MEDIUM EFFORT:
✅ Entity Hub Drawer (3-4 days) ⭐ START HERE
✅ Storyline layer (3 days)
✅ Trust panel (2 days)

HIGH IMPACT, HIGH EFFORT:
⚠️ Matchup Mode (5 days)
⚠️ Watchlist + Alerts (7 days)
⚠️ Inline video player (3 days)

LOW IMPACT, ANY EFFORT:
❌ Defer for now
```

---

## 🎯 Recommended Approach

### Week 1: Portal Mechanics
- Implement Entity Hub Drawer
- Wire all scoreboard rows to drawer
- Add receipts, trends, source breakdown
- Test on mobile + desktop

### Week 2: Context & Discovery
- Enhance What Changed rail
- Upgrade ticker behavior
- Add storylines layer
- Improve driver labels

### Week 3: Engagement Hooks
- Build watchlist system
- Add in-app alerts
- Implement matchup mode
- Add power user controls

### Week 4: Polish & Growth
- Trust/methodology panels
- Shareable artifacts
- Inline video player
- Performance optimization

---

## 📞 Questions for Consultants

1. **Entity Hub:** Should it be a drawer (slide-in) or modal (center overlay)?
2. **Matchup Mode:** Public shareable link or logged-in feature only?
3. **Storylines:** Auto-detect co-mentions or manual curation initially?
4. **Alerts:** Email/push or just in-app for MVP?
5. **Ticker:** One continuous lane or separate Breaking/Receipts lanes?

---

## 📦 File Structure After Implementation

```
components/
├── entity/                    ← NEW: Entity Hub Drawer
│   ├── EntityDrawer.tsx
│   ├── TrendChart.tsx
│   ├── ReceiptsList.tsx
│   └── SourceBreakdown.tsx
├── matchup/                   ← NEW: Comparison tool
│   ├── MatchupSelector.tsx
│   └── MatchupCard.tsx
├── storylines/                ← NEW: Arc visualization
│   ├── StorylineCard.tsx
│   └── StorylineTimeline.tsx
├── watchlist/                 ← NEW: Personalization
│   ├── WatchlistButton.tsx
│   └── AlertSettings.tsx
├── scoreboard/                ← EXISTING
│   ├── Masthead.tsx
│   ├── ScoreboardTable.tsx
│   ├── MoversRail.tsx         ← ENHANCE
│   └── CategoryCards.tsx
└── ticker/                    ← EXISTING
    └── TickerDock.tsx         ← ENHANCE

app/api/
├── entity/[id]/route.ts       ← NEW
├── changes/route.ts           ← NEW
├── matchup/route.ts           ← NEW
├── scoreboard/route.ts        ← EXISTING
├── movers/route.ts            ← EXISTING
└── feed/route.ts              ← EXISTING
```

---

**Status:** Ready for team review and sprint planning  
**Next Action:** Team decides which TIER 1 features to start with  
**Recommendation:** Start with Entity Hub Drawer (highest impact)

